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
import type { PairSignal } from '../signals/signal.types';
import { CloseReason } from '../common/types/enums';

type AgentDecision = {
  enter: Array<{ id: string; reasoning?: string }>;
  close: Array<{ id: string; reason: 'PROFIT_TARGET' | 'DRAWDOWN_LIMIT'; reasoning?: string }>;
  observe?: Array<{ pair: string; thoughts: string }>;
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

    return {
      schedulerActive: this.schedulerEnabled,
      nextRunAt: nextRun.toISOString(),
      intervalMinutes,
    };
  }

  async runCycleForUser(userId: string): Promise<CycleResult> {
    const cycleNum = await this.journalRepo.nextCycleNum(userId);
    this.logger.log(`Running agent cycle #${cycleNum} for user ${userId}`);

    // 1. Load last 5 journal entries
    const recentJournal = await this.journalRepo.findRecent(userId, 5);

    // 2. Load user instruction
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

    const candlesMap = await this.binance.getCandlesForPairs(allPairs, '1h', 200);

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

    // 6. Compute mathematical worksheets from candles
    const worksheetMap = new Map<string, PairWorksheet>();
    for (const pair of allPairs) {
      const candles = candlesMap[pair];
      if (candles?.length) {
        worksheetMap.set(pair, this.indicators.compute(cycleNum, candles));
      }
    }

    // 7. Persist worksheets so they're available outside of agent cycles
    await Promise.all(
      allPairs.map((pair) => {
        const ws = worksheetMap.get(pair);
        return ws ? this.pairKnowledge.updateWorksheet(userId, pair, ws) : Promise.resolve();
      }),
    );

    // 7b. Compute signal scores from worksheets (pure math, no AI)
    const signalMap = new Map<string, PairSignal>();
    for (const [pair, ws] of worksheetMap) {
      // Score both directions; pick the higher-conviction one for display
      const long = this.signalEngine.score(pair, ws, 'LONG');
      const short = this.signalEngine.score(pair, ws, 'SHORT');
      signalMap.set(pair, long.score >= short.score ? long : short);
    }

    // 8. Build prompt using worksheets + signal scores
    const prompt = this.buildPrompt(
      cycleNum,
      userInstruction,
      recentJournal,
      closedPositions,
      watchingPositions,
      openPositions,
      pairJournals,
      worksheetMap,
      priceMap,
      signalMap,
    );

    // 9. Call AI
    const raw = await this.ai.complete(prompt);
    const { decisions, journal } = this.parseResponse(raw, allPairs);

    // 10. Execute decisions
    const opened: string[] = [];
    const closed: string[] = [];

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
        undefined,
        worksheetMap.get(pos.pair) ? this.indicators.snapshot(worksheetMap.get(pos.pair)!) : undefined,
      );
    }

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
        worksheetMap.get(pos.pair) ? this.indicators.snapshot(worksheetMap.get(pos.pair)!) : undefined,
      );

      const newAmount = Math.max(0, (pos.amount ?? 0) * (1 + pnlPct / 100));
      if (reason === CloseReason.PROFIT_TARGET) {
        await this.positions.createWatchingFromClosed({
          userId,
          pair: pos.pair,
          direction: pos.direction,
          riskAppetite: (pos as any).riskAppetite ?? 'MEDIUM',
          amount: newAmount,
          instruction: (pos as any).instruction,
          mode,
        });
      } else {
        await this.positions.resume(pos.id);
      }
    }

    // 11. OBSERVE entries for pairs with no action this cycle
    const pairsWithAction = new Set([
      ...decisions.enter.map((e) => watchingPositions.find((p) => p.id === e.id)?.pair).filter(Boolean),
      ...decisions.close.map((c) => openPositions.find((p) => p.id === c.id)?.pair).filter(Boolean),
    ]);
    const observeByPair = new Map((decisions.observe ?? []).map((o) => [o.pair, o.thoughts]));
    for (const pair of allPairs) {
      if (!pairsWithAction.has(pair)) {
        const price = priceMap[pair] ?? 0;
        const thoughts = observeByPair.get(pair);
        const reasoning = thoughts?.trim() ? `${thoughts} (Price: ${price})` : `Price: ${price}`;
        await this.pairKnowledge.addObservation(
          userId,
          pair,
          cycleNum,
          price,
          reasoning,
          worksheetMap.get(pair) ? this.indicators.snapshot(worksheetMap.get(pair)!) : undefined,
        );
      }
    }

    // 12. Save cycle journal
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
    watchingPositions: Array<{ id: string; pair: string; direction: string; riskAppetite: string; instruction?: string; mode?: string }>,
    openPositions: Array<{
      id: string;
      pair: string;
      direction: string;
      entryPrice: number | null;
      activatedAt: Date | null;
      instruction?: string;
      mode?: string;
    }>,
    pairJournals: Array<{
      pair: string;
      confidence: number;
      summarisedKnowledge: string;
      entries: Array<{
        cycleNum: number;
        action: string;
        reasoning: string;
        mathAnalysis: { rsi14: number; emaTrend: string; macdHistogram: number; bbPosition: number; trendSlope: number; volatilityPct: number } | null;
        outcome: { pnl?: number; closeReason?: string; price?: number } | null;
        createdAt: Date;
      }>;
    }>,
    worksheetMap: Map<string, PairWorksheet>,
    priceMap: Record<string, number>,
    signalMap: Map<string, PairSignal>,
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
              const instr = p.instruction?.trim();
              const instrLine = instr ? ` | instruction: ${instr}` : '';
              const modeLine = p.mode === 'LIVE' ? ' | mode: LIVE (real money)' : '';
              return `id:${p.id} | ${p.pair} ${p.direction} | risk: ${p.riskAppetite}${modeLine}${instrLine}`;
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
              const instr = p.instruction?.trim();
              const instrLine = instr ? ` | instruction: ${instr}` : '';
              const modeLine = p.mode === 'LIVE' ? ' | mode: LIVE (real money)' : '';
              return `id:${p.id} | ${p.pair} ${p.direction} | entry: ${entry} | current: ${current ?? '?'} | pnl: ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}% | open ${hoursOpen}h${modeLine}${instrLine}`;
            })
            .join('\n');

    const pairAnalysisSection =
      pairJournals.length === 0
        ? 'No pair data yet.'
        : pairJournals
            .map((pj) => {
              const ws = worksheetMap.get(pj.pair);
              const sig = signalMap.get(pj.pair);
              const signalLine = sig
                ? `  Signal score: ${sig.score}/100 ${sig.direction} [${sig.label}] — ${sig.summary}\n    Components: trend=${sig.components.trend} momentum=${sig.components.momentum} oscillator=${sig.components.oscillator} model=${sig.components.model} volume=${sig.components.volume}`
                : '';
              const worksheetBlock = ws
                ? [
                    signalLine,
                    `  Indicators:`,
                    `    RSI(14)=${ws.indicators.rsi14} | EMA trend=${ws.indicators.emaTrend} (ema20=${ws.indicators.ema20} vs ema50=${ws.indicators.ema50})`,
                    `    MACD histogram=${ws.indicators.macdHistogram > 0 ? '+' : ''}${ws.indicators.macdHistogram} (${ws.indicators.macdHistogram > 0 ? 'bullish' : ws.indicators.macdHistogram < 0 ? 'bearish' : 'neutral'} momentum)`,
                    `    Bollinger: price at ${(ws.indicators.bbPosition * 100).toFixed(0)}% of band [${ws.indicators.bbLower}–${ws.indicators.bbUpper}]`,
                    `    Volume ratio=${ws.indicators.volumeRatio}x avg | ATR(14)=${ws.indicators.atr14} (${ws.model.volatilityPct}% volatility)`,
                    `  Trend model (20-candle regression):`,
                    `    Slope=${ws.model.trendSlope > 0 ? '+' : ''}${ws.model.trendSlope}/candle | R²=${ws.model.trendR2} | predicted next close=${ws.model.predictedNext}`,
                    `    Support=${ws.model.supportLevel} | Resistance=${ws.model.resistanceLevel}`,
                  ].filter(Boolean).join('\n')
                : '  No worksheet computed yet.';

              const recent = pj.entries.slice(0, 5);
              const entryLines = recent.map((e) => {
                const math = e.mathAnalysis
                  ? ` [RSI=${e.mathAnalysis.rsi14} ema=${e.mathAnalysis.emaTrend} macd=${e.mathAnalysis.macdHistogram > 0 ? '+' : ''}${e.mathAnalysis.macdHistogram} bb=${(e.mathAnalysis.bbPosition * 100).toFixed(0)}% slope=${e.mathAnalysis.trendSlope > 0 ? '+' : ''}${e.mathAnalysis.trendSlope}]`
                  : '';
                const outcome = e.outcome && 'pnl' in e.outcome && e.outcome.pnl != null
                  ? ` → ${e.outcome.pnl >= 0 ? '+' : ''}${e.outcome.pnl.toFixed(2)}% (${e.outcome.closeReason})`
                  : '';
                return `  Cycle ${e.cycleNum} ${e.action}: ${e.reasoning}${math}${outcome}`;
              });

              const knowledgeLine = pj.summarisedKnowledge
                ? `  Accumulated knowledge: ${pj.summarisedKnowledge}`
                : '';

              return [
                `${pj.pair} (confidence: ${pj.confidence.toFixed(0)}%):`,
                knowledgeLine,
                worksheetBlock,
                entryLines.length > 0 ? `  Recent decisions:\n${entryLines.join('\n')}` : '',
              ]
                .filter(Boolean)
                .join('\n');
            })
            .join('\n\n');

    const instructionSection =
      userInstruction.trim().length > 0
        ? `--- USER'S GOAL / INSTRUCTION ---\n${userInstruction.trim()}\n\n`
        : '';

    return `You are a crypto trading agent running cycle #${cycleNum}. Your job is to analyse each pair mathematically and historically, then make a clear decision and record your thinking.

${instructionSection}--- YOUR PAST CYCLE JOURNALS ---
${journalSection}

--- PAST OUTCOMES (recently closed positions) ---
${outcomesSection}

--- WATCHING — pairs waiting to enter ---
${watchingSection}

--- OPEN — positions currently in the market ---
${openSection}

--- PAIR ANALYSIS (indicators + history per pair) ---
${pairAnalysisSection}

--- HOW TO THINK AND DECIDE ---
Each pair now has a pre-computed Signal Score (0–100). This score is pure math — it already weighs EMA trend, MACD momentum, RSI+Bollinger oscillator, regression model, and volume. Use it as your starting point, not a replacement for your own reasoning.

For each pair, work through these steps:
1. SIGNAL READ: What is the signal score and label? Does it confirm or conflict with the position direction?
2. INDICATOR DRILL-DOWN: What do the individual indicators say? (RSI overbought/oversold? EMA cross? MACD momentum? Bollinger position?)
3. TREND MODEL: What does the regression slope say about direction and strength (R²)? Where is price relative to support/resistance?
4. HISTORY REVIEW: What happened in past cycles? Did previous entries at similar signal levels work out? What patterns have emerged?
5. DECISION: Based on signal + indicators + history, what is the right action and why?

Signal thresholds to guide you:
- STRONG_BUY (≥78) / BUY (≥62) in LONG direction → strong case to enter a LONG watching position
- STRONG_SELL (≤25) / SELL (≤40) in SHORT direction → strong case to enter a SHORT watching position
- Signal score dropping below 40 on an OPEN LONG → consider DRAWDOWN_LIMIT exit if history confirms
- Signal score above 80 while near resistance on OPEN LONG → consider PROFIT_TARGET exit
When mode is LIVE (real money), apply extra caution — require STRONG_BUY/STRONG_SELL signal plus indicator confirmation before acting.

--- INSTRUCTIONS ---
1. For each enter or close, provide "reasoning" that explicitly references the indicators and history that drove the decision.
2. For each pair you are NOT entering or closing, provide an "observe" entry with your mathematical read and what you're watching for.
3. Write a concise cycle journal (4-6 sentences) covering: what the market looks like across pairs, what the indicators showed, what you decided and why, and what you're watching next cycle.

Respond ONLY with valid JSON — no markdown fences, no extra text:
{
  "decisions": {
    "enter": [{"id": "<position-id>", "reasoning": "Specific indicator + history reasoning for entry..."}],
    "close": [{"id": "<position-id>", "reason": "PROFIT_TARGET" | "DRAWDOWN_LIMIT", "reasoning": "Specific indicator + history reasoning for exit..."}],
    "observe": [{"pair": "BTC/USDT", "thoughts": "Mathematical read and what you're watching..."}]
  },
  "journal": "Cycle #${cycleNum} thinking: market read → indicator signals → decisions made → what to watch..."
}`;
  }

  private parseResponse(raw: string, allPairs: string[]): { decisions: AgentDecision; journal: string } {
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
        observe?: Array<{ pair?: string; thoughts?: string }>;
      };
      journal?: string;
    };

    const observeRaw = parsed.decisions?.observe ?? [];
    const observe = observeRaw
      .filter((o): o is { pair: string; thoughts: string } =>
        typeof o?.pair === 'string' && typeof o?.thoughts === 'string' && allPairs.includes(o.pair),
      )
      .map((o) => ({ pair: o.pair, thoughts: o.thoughts.trim() }));

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
      observe: observe.length > 0 ? observe : undefined,
    };

    const journal =
      typeof parsed.journal === 'string' && parsed.journal.trim()
        ? parsed.journal.trim()
        : 'Agent completed cycle with no written reflection.';

    return { decisions, journal };
  }
}
