import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AiService } from '../ai/ai.service';
import { BinanceService } from '../binance/binance.service';
import { PositionsRepository } from '../positions/positions.repository';
import { ExecutionService } from '../execution/execution.service';
import { AgentJournalRepository, type JournalDecisions } from './agent-journal.repository';
import { AgentInstructionRepository } from './agent-instruction.repository';
import { PAIR_KNOWLEDGE_ENGINE, type PairKnowledgeEngine } from '../pair-knowledge/pair-knowledge.interface';
import { IndicatorsService } from '../indicators/indicators.service';
import type { PairWorksheet } from '../indicators/indicators.types';
import { SIGNAL_ENGINE, type SignalEngine } from '../signals/signal-engine.interface';
import { CloseReason } from '../common/types/enums';

// ─── Internal decision types ─────────────────────────────────────────────────

type EnterDecision = {
  id: string;
  pair: string;
  direction: string;
  score: number;
  reasoning: string;
};

type CloseDecision = {
  id: string;
  pair: string;
  direction: string;
  reason: 'PROFIT_TARGET' | 'DRAWDOWN_LIMIT';
  score: number;
  pnlPct: number;
  reasoning: string;
};

type ObserveEntry = {
  pair: string;
  score: number;
  thoughts: string;
};

type SignalDecisions = {
  enter: EnterDecision[];
  close: CloseDecision[];
  observe: ObserveEntry[];
};

// ─── Public types ─────────────────────────────────────────────────────────────

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

// Score thresholds for entering a position by risk appetite
const ENTER_THRESHOLD: Record<string, number> = { LOW: 72, MEDIUM: 65, HIGH: 58 };

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
    private readonly indicators: IndicatorsService,
    @Inject(PAIR_KNOWLEDGE_ENGINE) private readonly pairKnowledge: PairKnowledgeEngine,
    @Inject(SIGNAL_ENGINE) private readonly signalEngine: SignalEngine,
  ) {
    this.schedulerEnabled = true;
  }

  setSchedulerEnabled(enabled: boolean): void {
    this.schedulerEnabled = enabled;
  }

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

    return { schedulerActive: this.schedulerEnabled, nextRunAt: nextRun.toISOString(), intervalMinutes };
  }

  async runCycleForUser(userId: string): Promise<CycleResult> {
    const cycleNum = await this.journalRepo.nextCycleNum(userId);
    this.logger.log(`Running agent cycle #${cycleNum} for user ${userId}`);

    // 1. Load context
    const [recentJournal, userInstruction, watchingPositions, openPositions] =
      await Promise.all([
        this.journalRepo.findRecent(userId, 5),
        this.instructionRepo.get(userId),
        this.positions.findAllInactive(userId),
        this.positions.findAllActive(userId),
      ]);

    const allPairs = [...new Set([
      ...watchingPositions.map((p) => p.pair),
      ...openPositions.map((p) => p.pair),
    ])];

    const pairJournals = allPairs.length > 0
      ? await this.pairKnowledge.findForPairs(userId, allPairs)
      : [];

    // 2. Fetch market data
    const [candlesMap, candles4hMap] = await Promise.all([
      this.binance.getCandlesForPairs(allPairs, '1h', 200),
      this.binance.getCandlesForPairs(allPairs, '4h', 100),
    ]);

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

    // 3. Compute worksheets (1h enriched with 4h context)
    const worksheetMap = new Map<string, PairWorksheet>();
    for (const pair of allPairs) {
      const candles = candlesMap[pair];
      if (!candles?.length) continue;
      let ws = this.indicators.compute(cycleNum, candles);
      const c4h = candles4hMap[pair];
      if (c4h?.length) ws = this.indicators.enrich4h(ws, c4h);
      worksheetMap.set(pair, ws);
    }

    // 4. Persist worksheets
    await Promise.all(
      allPairs.map((pair) => {
        const ws = worksheetMap.get(pair);
        return ws ? this.pairKnowledge.updateWorksheet(userId, pair, ws) : Promise.resolve();
      }),
    );

    // 5. Make deterministic decisions from signal scores — no AI involved
    const decisions = this.makeDecisions(
      watchingPositions,
      openPositions,
      worksheetMap,
      priceMap,
    );

    // 6. Execute enter decisions
    const opened: string[] = [];
    for (const d of decisions.enter) {
      const pos = watchingPositions.find((p) => p.id === d.id);
      if (!pos) continue;
      const entryPrice = priceMap[pos.pair] ?? 0;
      const mode = (pos as { mode?: 'PAPER' | 'LIVE' }).mode ?? 'PAPER';
      await this.execution.enter(pos.id, entryPrice, mode);
      opened.push(pos.pair);
      await this.pairKnowledge.addEntry(
        userId, pos.pair, cycleNum, 'ENTER', d.reasoning, undefined,
        worksheetMap.get(pos.pair) ? this.indicators.snapshot(worksheetMap.get(pos.pair)!) : undefined,
      );
    }

    // 7. Execute close decisions
    const closed: string[] = [];
    for (const d of decisions.close) {
      const pos = openPositions.find((p) => p.id === d.id);
      if (!pos) continue;
      const currentPrice = priceMap[pos.pair] ?? (pos as any).currentPrice ?? pos.entryPrice ?? 0;
      const entryPrice = pos.entryPrice ?? currentPrice;
      const pnlPct =
        pos.direction === 'LONG'
          ? ((currentPrice - entryPrice) / entryPrice) * 100
          : ((entryPrice - currentPrice) / entryPrice) * 100;
      const reason = d.reason === 'PROFIT_TARGET' ? CloseReason.PROFIT_TARGET : CloseReason.DRAWDOWN_LIMIT;
      const mode = (pos as { mode?: 'PAPER' | 'LIVE' }).mode ?? 'PAPER';
      await this.execution.exit(pos.id, reason, pnlPct, currentPrice, mode);
      closed.push(`${pos.pair} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)`);
      await this.pairKnowledge.addEntry(
        userId, pos.pair, cycleNum, 'EXIT', d.reasoning,
        { pnl: pnlPct, closeReason: reason },
        worksheetMap.get(pos.pair) ? this.indicators.snapshot(worksheetMap.get(pos.pair)!) : undefined,
      );
      if (reason === CloseReason.PROFIT_TARGET) {
        const newAmount = Math.max(0, (pos.amount ?? 0) * (1 + pnlPct / 100));
        await this.positions.createWatchingFromClosed({
          userId, pair: pos.pair, direction: pos.direction,
          riskAppetite: (pos as any).riskAppetite ?? 'MEDIUM',
          amount: newAmount, instruction: (pos as any).instruction, mode,
        });
      } else {
        await this.positions.resume(pos.id);
      }
    }

    // 8. Record observations for pairs with no action
    const actedPairs = new Set([
      ...decisions.enter.map((d) => d.pair),
      ...decisions.close.map((d) => d.pair),
    ]);
    for (const obs of decisions.observe) {
      if (actedPairs.has(obs.pair)) continue;
      await this.pairKnowledge.addObservation(
        userId, obs.pair, cycleNum, priceMap[obs.pair] ?? 0, obs.thoughts,
        worksheetMap.get(obs.pair) ? this.indicators.snapshot(worksheetMap.get(obs.pair)!) : undefined,
      );
    }

    // 9. Ask LLM to write the cycle journal — decisions are already made, this is explanation only
    const journalPrompt = this.buildJournalPrompt(
      cycleNum, userInstruction, decisions, pairJournals, recentJournal,
    );
    const rawJournal = await this.ai.complete(journalPrompt);
    const journal = rawJournal.trim() || 'Agent completed cycle with no written reflection.';

    // 10. Save cycle journal
    const journalDecisions: JournalDecisions = {
      opened: decisions.enter.map((d) => ({ pair: d.pair, direction: d.direction })),
      closed: decisions.close.map((d) => ({ pair: d.pair, reason: d.reason, pnl: d.pnlPct })),
    };
    await this.journalRepo.save(userId, cycleNum, journal, journalDecisions);

    this.logger.log(`Cycle #${cycleNum} complete — entered: [${opened}] closed: [${closed}]`);
    return { cycleNum, opened, closed, journal };
  }

  // ─── Signal-driven decision engine ───────────────────────────────────────────

  /**
   * All enter/exit decisions are made here using signal scores and deterministic rules.
   * No AI is involved — same inputs always produce the same decisions.
   */
  private makeDecisions(
    watchingPositions: Array<{ id: string; pair: string; direction: string; riskAppetite: string; mode?: string }>,
    openPositions: Array<{ id: string; pair: string; direction: string; entryPrice: number | null; activatedAt: Date | null; amount?: number; mode?: string }>,
    worksheetMap: Map<string, PairWorksheet>,
    priceMap: Record<string, number>,
  ): SignalDecisions {
    const enter: EnterDecision[] = [];
    const close: CloseDecision[] = [];
    const actedPairs = new Set<string>();

    // ── Enter decisions ───────────────────────────────────────────────────────
    for (const pos of watchingPositions) {
      const ws = worksheetMap.get(pos.pair);
      if (!ws) continue;

      const dir = pos.direction as 'LONG' | 'SHORT';
      const sig = this.signalEngine.score(pos.pair, ws, dir);
      const threshold = ENTER_THRESHOLD[pos.riskAppetite] ?? 65;

      // 4h gate: block entry if 4h trend strongly opposes direction
      const stronglyOpposed =
        ws.context &&
        ((dir === 'LONG' && ws.context.trend4h === 'bearish' && ws.context.adx4h > 25) ||
          (dir === 'SHORT' && ws.context.trend4h === 'bullish' && ws.context.adx4h > 25));

      // Don't enter into a dying trend (very weak ADX on 4h)
      const dyingTrend = ws.context && ws.context.adx4h < 15 && ws.indicators.adxTrend === 'ranging';

      if (sig.score >= threshold && !stronglyOpposed && !dyingTrend) {
        enter.push({ id: pos.id, pair: pos.pair, direction: dir, score: sig.score, reasoning: sig.summary });
        actedPairs.add(pos.pair);
      }
    }

    // ── Close decisions ───────────────────────────────────────────────────────
    for (const pos of openPositions) {
      const ws = worksheetMap.get(pos.pair);
      if (!ws) continue;

      const dir = pos.direction as 'LONG' | 'SHORT';
      const sig = this.signalEngine.score(pos.pair, ws, dir);

      const currentPrice = priceMap[pos.pair] ?? 0;
      const entryPrice = pos.entryPrice ?? currentPrice;
      const pnlPct =
        entryPrice > 0
          ? dir === 'LONG'
            ? ((currentPrice - entryPrice) / entryPrice) * 100
            : ((entryPrice - currentPrice) / entryPrice) * 100
          : 0;

      const { supportLevel, resistanceLevel } = ws.model;
      const nearExit =
        (dir === 'LONG' && resistanceLevel > 0 && currentPrice >= resistanceLevel * 0.985) ||
        (dir === 'SHORT' && supportLevel > 0 && currentPrice <= supportLevel * 1.015);

      const fourHReversed =
        ws.context &&
        ((dir === 'LONG' && ws.context.trend4h === 'bearish') ||
          (dir === 'SHORT' && ws.context.trend4h === 'bullish'));

      let closeReason: 'PROFIT_TARGET' | 'DRAWDOWN_LIMIT' | null = null;
      let closeReasonText = '';

      // Strong reversal — exit regardless of PnL
      if (sig.score < 32) {
        closeReason = pnlPct >= 0 ? 'PROFIT_TARGET' : 'DRAWDOWN_LIMIT';
        closeReasonText = `Strong reversal signal (score ${sig.score}). ${sig.summary}`;
      }
      // Momentum fading near target while in profit — take it
      else if (pnlPct > 0 && sig.score < 45 && nearExit) {
        closeReason = 'PROFIT_TARGET';
        closeReasonText = `Score faded to ${sig.score} while near ${dir === 'LONG' ? 'resistance' : 'support'} with pnl +${pnlPct.toFixed(2)}%. ${sig.summary}`;
      }
      // 4h has reversed against us and signal is weakening
      else if (fourHReversed && sig.score < 48) {
        closeReason = pnlPct >= 0 ? 'PROFIT_TARGET' : 'DRAWDOWN_LIMIT';
        closeReasonText = `4h trend reversed against ${dir} and signal at ${sig.score}. ${sig.summary}`;
      }

      if (closeReason) {
        close.push({ id: pos.id, pair: pos.pair, direction: dir, reason: closeReason, score: sig.score, pnlPct, reasoning: closeReasonText });
        actedPairs.add(pos.pair);
      }
    }

    // ── Observe: all pairs with no action ────────────────────────────────────
    const observe: ObserveEntry[] = [];
    for (const [pair, ws] of worksheetMap) {
      if (actedPairs.has(pair)) continue;
      // Score in the direction the position is tracking, or best direction if only watching
      const watchingDir = watchingPositions.find((p) => p.pair === pair)?.direction as 'LONG' | 'SHORT' | undefined;
      const openDir = openPositions.find((p) => p.pair === pair)?.direction as 'LONG' | 'SHORT' | undefined;
      const dir = openDir ?? watchingDir;
      const sig = dir
        ? this.signalEngine.score(pair, ws, dir)
        : (() => {
            const l = this.signalEngine.score(pair, ws, 'LONG');
            const s = this.signalEngine.score(pair, ws, 'SHORT');
            return l.score >= s.score ? l : s;
          })();
      observe.push({ pair, score: sig.score, thoughts: sig.summary });
    }

    return { enter, close, observe };
  }

  // ─── Journal prompt ───────────────────────────────────────────────────────────

  /**
   * Compact prompt — decisions are already made. The LLM's only job is to write
   * a readable journal entry explaining what the math showed and what happened.
   */
  private buildJournalPrompt(
    cycleNum: number,
    userInstruction: string,
    decisions: SignalDecisions,
    pairJournals: Array<{
      pair: string;
      confidence: number;
      summarisedKnowledge: string;
    }>,
    recentJournal: Array<{ cycleNum: number; entry: string; createdAt: Date }>,
  ): string {
    const pastJournals =
      recentJournal.length === 0
        ? 'No previous journals.'
        : recentJournal
            .slice(0, 3)
            .map((j) => `[Cycle ${j.cycleNum}]: ${j.entry}`)
            .join('\n');

    const knowledgeSummary =
      pairJournals.length === 0
        ? ''
        : pairJournals
            .filter((pj) => pj.summarisedKnowledge)
            .map((pj) => `${pj.pair} (confidence ${pj.confidence.toFixed(0)}%): ${pj.summarisedKnowledge}`)
            .join('\n');

    const enterLines = decisions.enter.map(
      (d) => `  ENTERED ${d.pair} ${d.direction} [score ${d.score}]: ${d.reasoning}`,
    );
    const closeLines = decisions.close.map(
      (d) =>
        `  ${d.reason} ${d.pair} ${d.direction} [score ${d.score}, pnl ${d.pnlPct >= 0 ? '+' : ''}${d.pnlPct.toFixed(2)}%]: ${d.reasoning}`,
    );
    const observeLines = decisions.observe.slice(0, 6).map(
      (o) => `  WATCHING ${o.pair} [score ${o.score}]: ${o.thoughts}`,
    );

    const decisionBlock = [...enterLines, ...closeLines, ...observeLines].join('\n') ||
      '  No significant moves — all pairs held or no pairs tracked.';

    const instrLine = userInstruction.trim()
      ? `\nTrader's goal: ${userInstruction.trim()}\n`
      : '';

    return `You are writing a trading cycle journal for cycle #${cycleNum}.${instrLine}
The signal engine already made all decisions using mathematical rules — your job is to write a clear, insightful 4-6 sentence journal entry that explains what happened.

WHAT THE MATH DECIDED THIS CYCLE:
${decisionBlock}

ACCUMULATED PAIR KNOWLEDGE:
${knowledgeSummary || 'No pair knowledge yet.'}

RECENT PAST JOURNALS:
${pastJournals}

Write the journal entry as plain text (no JSON, no headers). Cover: what the overall market looked like across pairs, what the key signals indicated, what was entered/closed and why the math triggered it, and what to watch next cycle. Reference specific indicator values and signal scores where relevant.`;
  }
}
