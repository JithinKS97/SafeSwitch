import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AiService } from '../ai/ai.service';
import { BinanceService } from '../binance/binance.service';
import { PositionsRepository } from '../positions/positions.repository';
import { ExecutionService } from '../execution/execution.service';
import { AgentJournalRepository, type JournalDecisions } from './agent-journal.repository';
import { AgentInstructionRepository } from './agent-instruction.repository';
import { PAIR_KNOWLEDGE_ENGINE, type PairKnowledgeEngine } from '../pair-knowledge/pair-knowledge.interface';
import { CloseReason } from '../common/types/enums';

type AgentDecision = {
  enter: Array<{ id: string; reasoning?: string }>;
  close: Array<{ id: string; reason: 'PROFIT_TARGET' | 'DRAWDOWN_LIMIT'; reasoning?: string }>;
};

export type CycleResult = {
  cycleNum: number;
  opened: string[];
  closed: string[];
  journal: string;
};

export type SchedulerStatus = {
  schedulerActive: boolean;
  nextRunAt: string;
  intervalMinutes: number;
};

@Injectable()
export class TradingAgentService {
  private readonly logger = new Logger(TradingAgentService.name);
  private schedulerEnabled: boolean;

  constructor(
    private readonly ai: AiService,
    private readonly binance: BinanceService,
    private readonly positions: PositionsRepository,
    private readonly execution: ExecutionService,
    private readonly journalRepo: AgentJournalRepository,
    private readonly instructionRepo: AgentInstructionRepository,
    @Inject(PAIR_KNOWLEDGE_ENGINE) private readonly pairKnowledge: PairKnowledgeEngine,
  ) {
    this.schedulerEnabled = false;
  }

  setSchedulerEnabled(enabled: boolean): void {
    this.schedulerEnabled = enabled;
  }

  // Scheduled: every N minutes (AGENT_CRON_INTERVAL_MINUTES, default 15)
  @Cron(
    (() => {
      const mins = parseInt(process.env.AGENT_CRON_INTERVAL_MINUTES ?? '15', 10);
      const n = Number.isFinite(mins) && mins >= 1 ? mins : 15;
      return `0 */${n} * * * *`;
    })(),
  )
  async scheduledCycle() {
    if (!this.schedulerEnabled) return;
    this.logger.log('Scheduled agent cycle starting');
    const managedUsers = await this.positions.findAllManagedAcrossUsers();
    const userIds = [...new Set(managedUsers.map((r) => r.userId))];

    if (userIds.length === 0) {
      this.logger.log('No users with managed positions, skipping cycle');
      return;
    }

    for (const userId of userIds) {
      try {
        await this.runCycleForUser(userId);
      } catch (err) {
        this.logger.error(`Agent cycle failed for user ${userId}: ${(err as Error).message}`);
      }
    }
  }

  getSchedulerStatus(): SchedulerStatus {
    const interval = parseInt(process.env.AGENT_CRON_INTERVAL_MINUTES ?? '15', 10);
    const intervalMinutes = Number.isFinite(interval) && interval >= 1 ? interval : 15;

    const now = new Date();
    now.setSeconds(0, 0);
    const totalMins = now.getHours() * 60 + now.getMinutes();
    const nextTotalMins = (Math.floor(totalMins / intervalMinutes) + 1) * intervalMinutes;

    const nextRun = new Date(now);
    if (nextTotalMins >= 24 * 60) {
      nextRun.setDate(nextRun.getDate() + 1);
      nextRun.setHours(0, nextTotalMins - 24 * 60, 0, 0);
    } else {
      nextRun.setHours(Math.floor(nextTotalMins / 60), nextTotalMins % 60, 0, 0);
    }

    return {
      schedulerActive: this.schedulerEnabled,
      nextRunAt: nextRun.toISOString(),
      intervalMinutes,
    };
  }

  // Manual trigger: run for a specific user
  async runCycleForUser(userId: string): Promise<CycleResult> {
    const cycleNum = await this.journalRepo.nextCycleNum(userId);
    this.logger.log(`Running agent cycle #${cycleNum} for user ${userId}`);

    // 1. Load last 5 journal entries
    const recentJournal = await this.journalRepo.findRecent(userId, 5);

    // 2. Load user instruction (goal for the day, etc.)
    const userInstruction = await this.instructionRepo.get(userId);

    // 3. Load last 10 closed positions with outcomes
    const closedPositions = await this.positions.findClosed(userId, 10);

    // 4. Load watching (INACTIVE) and open (ACTIVE) positions
    const watchingPositions = await this.positions.findAllInactive(userId);
    const openPositions = await this.positions.findAllActive(userId);

    // 5. Fetch candles and prices for all managed pairs
    const allPairs = [...new Set([
      ...watchingPositions.map((p) => p.pair),
      ...openPositions.map((p) => p.pair),
    ])];

    const pairJournals = allPairs.length > 0
      ? await this.pairKnowledge.findForPairs(userId, allPairs)
      : [];

    const candlesMap = await this.binance.getCandlesForPairs(allPairs, '1h', 48);

    const priceMap: Record<string, number> = {};
    await Promise.all(
      allPairs.map(async (pair) => {
        try {
          priceMap[pair] = await this.binance.getCurrentPrice(pair);
        } catch {
          const candles = candlesMap[pair];
          if (candles?.length) priceMap[pair] = candles[candles.length - 1].close;
        }
      }),
    );

    // 6. Build prompt
    const prompt = this.buildPrompt(
      cycleNum,
      userInstruction,
      recentJournal,
      closedPositions,
      watchingPositions,
      openPositions,
      pairJournals,
      priceMap,
      candlesMap,
    );

    // 7. Call AI
    const raw = await this.ai.complete(prompt);
    const { decisions, journal } = this.parseResponse(raw);

    // 8. Execute decisions
    const opened: string[] = [];
    const closed: string[] = [];

    // Enter: agent decides to open a Watching position (paper or live based on position mode)
    for (const enterDecision of decisions.enter) {
      const pos = watchingPositions.find((p) => p.id === enterDecision.id);
      if (!pos) continue;
      const entryPrice = priceMap[pos.pair] ?? 0;
      const mode = (pos as { mode?: 'PAPER' | 'LIVE' }).mode ?? 'PAPER';
      await this.execution.enter(pos.id, entryPrice, mode);
      opened.push(pos.pair);
      await this.pairKnowledge.addEntry(
        userId,
        pos.pair,
        cycleNum,
        'ENTER',
        enterDecision.reasoning ?? 'Entered position.',
      );
    }

    // Close: agent decides to exit an Open position (paper or live based on position mode)
    for (const closeDecision of decisions.close) {
      const pos = openPositions.find((p) => p.id === closeDecision.id);
      if (!pos) continue;

      const currentPrice = priceMap[pos.pair] ?? (pos as any).currentPrice ?? pos.entryPrice ?? 0;
      const entryPrice = pos.entryPrice ?? currentPrice;
      const pnlPct =
        pos.direction === 'LONG'
          ? ((currentPrice - entryPrice) / entryPrice) * 100
          : ((entryPrice - currentPrice) / entryPrice) * 100;

      const reason =
        closeDecision.reason === 'PROFIT_TARGET'
          ? CloseReason.PROFIT_TARGET
          : CloseReason.DRAWDOWN_LIMIT;

      const mode = (pos as { mode?: 'PAPER' | 'LIVE' }).mode ?? 'PAPER';
      await this.execution.exit(pos.id, reason, pnlPct, currentPrice, mode);
      closed.push(`${pos.pair} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)`);
      await this.pairKnowledge.addEntry(
        userId,
        pos.pair,
        cycleNum,
        'EXIT',
        closeDecision.reasoning ?? 'Exited position.',
        { pnl: pnlPct, closeReason: reason },
      );
    }

    // 9. Save journal entry
    const journalDecisions: JournalDecisions = {
      opened: decisions.enter.map((e) => {
        const pos = watchingPositions.find((p) => p.id === e.id);
        return { pair: pos?.pair ?? e.id, direction: (pos as any)?.direction ?? '' };
      }),
      closed: decisions.close.map((c) => {
        const pos = openPositions.find((p) => p.id === c.id);
        return { pair: pos?.pair ?? c.id, reason: c.reason, pnl: 0 };
      }),
    };
    await this.journalRepo.save(userId, cycleNum, journal, journalDecisions);

    this.logger.log(`Cycle #${cycleNum} complete — entered: [${opened}] closed: [${closed}]`);
    return { cycleNum, opened, closed, journal };
  }

  private buildPrompt(
    cycleNum: number,
    userInstruction: string,
    recentJournal: Array<{ cycleNum: number; entry: string; createdAt: Date }>,
    closedPositions: Array<{
      pair: string;
      direction: string;
      pnl: number;
      closeReason: string | null;
      entryPrice: number | null;
      currentPrice: number | null;
      closedAt: Date | null;
    }>,
    watchingPositions: Array<{ id: string; pair: string; direction: string; riskAppetite: string }>,
    openPositions: Array<{
      id: string;
      pair: string;
      direction: string;
      entryPrice: number | null;
      activatedAt: Date | null;
    }>,
    pairJournals: Array<{ pair: string; confidence: number; summarisedKnowledge: string; entries: Array<{ cycleNum: number; action: string; reasoning: string; outcome: { pnl: number; closeReason: string } | null; createdAt: Date }> }>,
    priceMap: Record<string, number>,
    candlesMap: Record<string, Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>>,
  ): string {
    const journalSection =
      recentJournal.length === 0
        ? 'No previous entries.'
        : recentJournal
            .map((j) => `[Cycle ${j.cycleNum} | ${j.createdAt.toISOString().slice(0, 10)}]: ${j.entry}`)
            .join('\n');

    const outcomesSection =
      closedPositions.length === 0
        ? 'No closed positions yet.'
        : closedPositions
            .map(
              (p) =>
                `${p.pair} ${p.direction} | entry: ${p.entryPrice ?? '?'} | exit: ${p.currentPrice ?? '?'} | pnl: ${p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(2)}% | reason: ${p.closeReason ?? 'MANUAL'}`,
            )
            .join('\n');

    const watchingSection =
      watchingPositions.length === 0
        ? 'No pairs waiting to enter.'
        : watchingPositions
            .map((p) => {
              const current = priceMap[p.pair];
              return `id:${p.id} | ${p.pair} ${p.direction} | risk: ${p.riskAppetite} | current price: ${current ?? '?'}`;
            })
            .join('\n');

    const openSection =
      openPositions.length === 0
        ? 'No open positions.'
        : openPositions
            .map((p) => {
              const current = priceMap[p.pair];
              const entry = p.entryPrice ?? 0;
              const pnlPct =
                entry && current
                  ? p.direction === 'LONG'
                    ? ((current - entry) / entry) * 100
                    : ((entry - current) / entry) * 100
                  : 0;
              const hoursOpen = p.activatedAt
                ? Math.round((Date.now() - p.activatedAt.getTime()) / 3_600_000)
                : 0;
              return `id:${p.id} | ${p.pair} ${p.direction} | entry: ${entry} | current: ${current ?? '?'} | pnl: ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}% | open ${hoursOpen}h`;
            })
            .join('\n');

    const candleSection = Object.entries(candlesMap)
      .map(([pair, candles]) => {
        const rows = candles
          .slice(-24)
          .map((c) => `${new Date(c.time).toISOString().slice(11, 16)} O:${c.open} H:${c.high} L:${c.low} C:${c.close} V:${Math.round(c.volume)}`)
          .join(' | ');
        return `${pair}: ${rows}`;
      })
      .join('\n');

    const pairJournalSection =
      pairJournals.length === 0
        ? 'No pair journals yet.'
        : pairJournals
            .map((pj) => {
              const summary = pj.summarisedKnowledge;
              const recent = pj.entries.slice(0, 5);
              const lines = recent.map(
                (e) =>
                  `  Cycle ${e.cycleNum} ${e.action}: ${e.reasoning}${e.outcome ? ` (outcome: ${JSON.stringify(e.outcome)})` : ''}`,
              );
              const knowledgeBlock = summary ? `\n  Knowledge: ${summary}` : '';
              return `${pj.pair} (confidence: ${pj.confidence.toFixed(0)}%):${knowledgeBlock}\n${lines.join('\n')}`;
            })
            .join('\n\n');

    const instructionSection =
      userInstruction.trim().length > 0
        ? `--- USER'S GOAL / INSTRUCTION ---\n${userInstruction.trim()}\n\n`
        : '';

    return `You are a crypto trading agent running cycle #${cycleNum}. The user has chosen the pairs below — your job is to decide when to enter them and when to exit open positions.
${instructionSection}--- YOUR JOURNAL (last entries) ---
${journalSection}

--- PAST OUTCOMES (closed positions) ---
${outcomesSection}

--- WATCHING — pairs waiting to enter ---
${watchingSection}

--- OPEN — positions already in the market ---
${openSection}

--- PAIR JOURNALS (your past reasoning per pair) ---
${pairJournalSection}

--- MARKET CANDLES (1h, last 24 candles per pair) ---
${candleSection}

--- INSTRUCTIONS ---
1. For WATCHING pairs: decide if now is a good entry point based on candle momentum and trend. Enter only if conditions are clearly favourable.
2. For OPEN positions: decide whether to hold or close. Close with PROFIT_TARGET if in meaningful profit and momentum is fading; close with DRAWDOWN_LIMIT if losing and trend is against it.
3. Do NOT invent new pairs — only act on the IDs listed above.
4. For EACH enter or close decision, provide a short "reasoning" (1-2 sentences) explaining why. This will be stored in the pair journal for the user to review.
5. Write a concise journal entry (3-5 sentences) about what you observed and decided.

Respond ONLY with valid JSON — no markdown fences, no extra text:
{
  "decisions": {
    "enter": [{"id": "<position-id>", "reasoning": "Why you're entering now..."}],
    "close": [{"id": "<position-id>", "reason": "PROFIT_TARGET" | "DRAWDOWN_LIMIT", "reasoning": "Why you're closing now..."}]
  },
  "journal": "Your reflection here..."
}`;
  }

  private parseResponse(raw: string): { decisions: AgentDecision; journal: string } {
    const cleaned = raw
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON in agent response');

    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
      decisions?: {
        enter?: Array<{ id?: string; reasoning?: string }>;
        close?: Array<{ id?: string; reason?: string; reasoning?: string }>;
      };
      journal?: string;
    };

    const decisions: AgentDecision = {
      enter: (parsed.decisions?.enter ?? []).map((e) => ({
        id: String(e?.id ?? ''),
        reasoning: typeof e?.reasoning === 'string' ? e.reasoning : undefined,
      })),
      close: (parsed.decisions?.close ?? []).map((c) => ({
        id: String(c?.id ?? ''),
        reason: (c?.reason === 'PROFIT_TARGET' || c?.reason === 'DRAWDOWN_LIMIT' ? c.reason : 'DRAWDOWN_LIMIT') as 'PROFIT_TARGET' | 'DRAWDOWN_LIMIT',
        reasoning: typeof c?.reasoning === 'string' ? c.reasoning : undefined,
      })),
    };

    const journal =
      typeof parsed.journal === 'string' && parsed.journal.trim()
        ? parsed.journal.trim()
        : 'Agent completed cycle with no written reflection.';

    return { decisions, journal };
  }
}
