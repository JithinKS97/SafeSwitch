import { Injectable, Logger, Inject } from '@nestjs/common';
import { BinanceService } from '../binance/binance.service';
import { IndicatorsService } from '../indicators/indicators.service';
import { SIGNAL_ENGINE, type SignalEngine } from '../signals/signal-engine.interface';
import type { PairWorksheet } from '../indicators/indicators.types';
import type { Candle } from '../binance/binance.types';
import type {
  BacktestConfig,
  BacktestResult,
  BacktestPairResult,
  BacktestTrade,
  LabelStats,
} from './backtest.types';

// Mirrors the live engine thresholds
const ENTER_THRESHOLD: Record<string, number> = { LOW: 72, MEDIUM: 65, HIGH: 58 };

type SimulatedPosition = {
  direction: 'LONG' | 'SHORT';
  entryTime: number;
  entryPrice: number;
  entryScore: number;
  entryLabel: string;
  entryRegime: 'trending' | 'ranging';
  entry4hTrend: string;
};

@Injectable()
export class BacktestService {
  private readonly logger = new Logger(BacktestService.name);

  constructor(
    private readonly binance: BinanceService,
    private readonly indicators: IndicatorsService,
    @Inject(SIGNAL_ENGINE) private readonly signalEngine: SignalEngine,
  ) {}

  async run(config: BacktestConfig): Promise<BacktestResult> {
    const start = Date.now();
    const daysBack = Math.min(config.daysBack, 90);
    // 1h candles: daysBack*24 + 200 warmup. 4h candles: daysBack*6 + 50 warmup.
    const total1h = daysBack * 24 + 200;
    const total4h = Math.ceil(daysBack * 6) + 50;

    this.logger.log(
      `Backtest: ${config.pairs.length} pairs × ${daysBack}d | ` +
        `fetching ${total1h} × 1h + ${total4h} × 4h candles per pair`,
    );

    const pairResults: BacktestPairResult[] = [];

    for (const pair of config.pairs) {
      try {
        const result = await this.backtestPair(pair, config, total1h, total4h);
        pairResults.push(result);
        // Small delay between pairs to be respectful of rate limits
        await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        this.logger.warn(`Backtest failed for ${pair}: ${(err as Error).message}`);
      }
    }

    const summary = this.buildSummary(config, pairResults);
    return { config, durationMs: Date.now() - start, pairs: pairResults, summary };
  }

  // ─── Per-pair walk-forward ────────────────────────────────────────────────

  private async backtestPair(
    pair: string,
    config: BacktestConfig,
    total1h: number,
    total4h: number,
  ): Promise<BacktestPairResult> {
    // Fetch historical candles — free Binance public endpoint
    const [candles1h, candles4h] = await Promise.all([
      this.binance.getCandlesPaginated(pair, '1h', total1h),
      this.binance.getCandlesPaginated(pair, '4h', total4h),
    ]);

    if (candles1h.length < 210) {
      throw new Error(`Insufficient 1h candle history for ${pair}`);
    }

    const WARMUP = 200;
    const directions: Array<'LONG' | 'SHORT'> =
      config.direction === 'LONG' ? ['LONG'] :
      config.direction === 'SHORT' ? ['SHORT'] :
      ['LONG', 'SHORT'];

    const trades: BacktestTrade[] = [];
    // One simulated position per direction
    const openPositions = new Map<'LONG' | 'SHORT', SimulatedPosition>();

    const threshold = ENTER_THRESHOLD[config.riskAppetite] ?? 65;

    for (let i = WARMUP; i < candles1h.length; i++) {
      const currentCandle = candles1h[i];
      const currentPrice = currentCandle.close;
      const currentTime = currentCandle.time;

      // Compute worksheet — only pass candles seen so far (no look-ahead)
      const history1h = candles1h.slice(0, i + 1);
      const history4h = candles4h.filter((c) => c.time <= currentTime);

      let ws: PairWorksheet = this.indicators.compute(0, history1h);
      if (history4h.length >= 50) ws = this.indicators.enrich4h(ws, history4h);

      for (const dir of directions) {
        const sig = this.signalEngine.score(pair, ws, dir);
        const openPos = openPositions.get(dir);

        // ── Check exit for open position ──────────────────────────────────
        if (openPos) {
          const entryPrice = openPos.entryPrice;
          const pnlPct =
            dir === 'LONG'
              ? ((currentPrice - entryPrice) / entryPrice) * 100
              : ((entryPrice - currentPrice) / entryPrice) * 100;

          const { supportLevel, resistanceLevel } = ws.model;
          const nearExit =
            (dir === 'LONG' && resistanceLevel > 0 && currentPrice >= resistanceLevel * 0.985) ||
            (dir === 'SHORT' && supportLevel > 0 && currentPrice <= supportLevel * 1.015);

          const fourHReversed =
            ws.context &&
            ((dir === 'LONG' && ws.context.trend4h === 'bearish') ||
              (dir === 'SHORT' && ws.context.trend4h === 'bullish'));

          let closeReason: BacktestTrade['closeReason'] | null = null;
          if (sig.score < 32) {
            closeReason = pnlPct >= 0 ? 'PROFIT_TARGET' : 'DRAWDOWN_LIMIT';
          } else if (pnlPct > 0 && sig.score < 45 && nearExit) {
            closeReason = 'PROFIT_TARGET';
          } else if (fourHReversed && sig.score < 48) {
            closeReason = pnlPct >= 0 ? 'PROFIT_TARGET' : 'DRAWDOWN_LIMIT';
          }

          if (closeReason) {
            trades.push({
              pair, direction: dir,
              entryTime: new Date(openPos.entryTime).toISOString(),
              exitTime: new Date(currentTime).toISOString(),
              entryPrice: openPos.entryPrice,
              exitPrice: currentPrice,
              pnlPct,
              closeReason,
              entrySignalScore: openPos.entryScore,
              entrySignalLabel: openPos.entryLabel,
              entryRegime: openPos.entryRegime,
              entry4hTrend: openPos.entry4hTrend,
            });
            openPositions.delete(dir);
          }
          continue; // don't enter while a position is open for this direction
        }

        // ── Check entry ───────────────────────────────────────────────────
        const stronglyOpposed =
          ws.context &&
          ((dir === 'LONG' && ws.context.trend4h === 'bearish' && ws.context.adx4h > 25) ||
            (dir === 'SHORT' && ws.context.trend4h === 'bullish' && ws.context.adx4h > 25));

        const dyingTrend =
          ws.context && ws.context.adx4h < 15 && ws.indicators.adxTrend === 'ranging';

        if (sig.score >= threshold && !stronglyOpposed && !dyingTrend) {
          openPositions.set(dir, {
            direction: dir,
            entryTime: currentTime,
            entryPrice: currentPrice,
            entryScore: sig.score,
            entryLabel: sig.label,
            entryRegime: ws.indicators.adxTrend,
            entry4hTrend: ws.context?.trend4h ?? 'unknown',
          });
        }
      }
    }

    // Close any positions still open at end of data
    const lastCandle = candles1h[candles1h.length - 1];
    for (const [dir, pos] of openPositions) {
      const pnlPct =
        dir === 'LONG'
          ? ((lastCandle.close - pos.entryPrice) / pos.entryPrice) * 100
          : ((pos.entryPrice - lastCandle.close) / pos.entryPrice) * 100;
      trades.push({
        pair, direction: dir,
        entryTime: new Date(pos.entryTime).toISOString(),
        exitTime: new Date(lastCandle.time).toISOString(),
        entryPrice: pos.entryPrice,
        exitPrice: lastCandle.close,
        pnlPct,
        closeReason: 'END_OF_DATA',
        entrySignalScore: pos.entryScore,
        entrySignalLabel: pos.entryLabel,
        entryRegime: pos.entryRegime,
        entry4hTrend: pos.entry4hTrend,
      });
    }

    return this.aggregatePairResult(pair, trades);
  }

  // ─── Aggregation ──────────────────────────────────────────────────────────

  private aggregatePairResult(pair: string, trades: BacktestTrade[]): BacktestPairResult {
    const closed = trades.filter((t) => t.pnlPct !== null);
    const wins = closed.filter((t) => (t.pnlPct ?? 0) > 0);

    const byLabel: Record<string, LabelStats> = {};
    const byRegime: Record<string, LabelStats> = {};
    const byScoreBand: Record<string, LabelStats> = {};

    const scoreBand = (score: number): string => {
      if (score >= 80) return '80+';
      if (score >= 72) return '72-80';
      if (score >= 65) return '65-72';
      return '58-65';
    };

    for (const t of closed) {
      const pnl = t.pnlPct ?? 0;
      const isWin = pnl > 0;
      for (const [key, group] of [
        [t.entrySignalLabel, byLabel] as const,
        [t.entryRegime, byRegime] as const,
        [scoreBand(t.entrySignalScore), byScoreBand] as const,
      ]) {
        if (!group[key]) group[key] = { trades: 0, wins: 0, losses: 0, winRate: 0, avgPnl: 0 };
        const s = group[key];
        s.trades++;
        if (isWin) s.wins++; else s.losses++;
        s.avgPnl += pnl;
      }
    }

    // Finalise averages
    for (const g of [byLabel, byRegime, byScoreBand]) {
      for (const s of Object.values(g)) {
        s.winRate = s.trades > 0 ? s.wins / s.trades : 0;
        s.avgPnl = s.trades > 0 ? s.avgPnl / s.trades : 0;
      }
    }

    // Max drawdown
    let peak = 0, drawdown = 0, cumPnl = 0;
    for (const t of closed) {
      cumPnl += t.pnlPct ?? 0;
      if (cumPnl > peak) peak = cumPnl;
      const dd = peak - cumPnl;
      if (dd > drawdown) drawdown = dd;
    }

    const totalPnl = closed.reduce((s, t) => s + (t.pnlPct ?? 0), 0);

    return {
      pair,
      totalTrades: closed.length,
      wins: wins.length,
      losses: closed.length - wins.length,
      winRate: closed.length > 0 ? wins.length / closed.length : 0,
      avgPnlPct: closed.length > 0 ? totalPnl / closed.length : 0,
      totalPnlPct: totalPnl,
      maxDrawdownPct: drawdown,
      byLabel,
      byRegime,
      byScoreBand,
      trades: trades.slice(0, 200),
    };
  }

  private buildSummary(config: BacktestConfig, pairs: BacktestPairResult[]) {
    const allTrades = pairs.flatMap((p) => p.trades).filter((t) => t.pnlPct !== null);
    const wins = allTrades.filter((t) => (t.pnlPct ?? 0) > 0);
    const totalPnl = allTrades.reduce((s, t) => s + (t.pnlPct ?? 0), 0);

    // Best label by win rate (min 3 trades)
    const labelMap: Record<string, LabelStats> = {};
    for (const p of pairs) {
      for (const [label, stats] of Object.entries(p.byLabel)) {
        if (!labelMap[label]) labelMap[label] = { trades: 0, wins: 0, losses: 0, winRate: 0, avgPnl: 0 };
        labelMap[label].trades += stats.trades;
        labelMap[label].wins += stats.wins;
        labelMap[label].avgPnl += stats.avgPnl * stats.trades;
      }
    }
    for (const s of Object.values(labelMap)) {
      s.winRate = s.trades > 0 ? s.wins / s.trades : 0;
      s.avgPnl = s.trades > 0 ? s.avgPnl / s.trades : 0;
    }
    const bestLabel = Object.entries(labelMap)
      .filter(([, s]) => s.trades >= 3)
      .sort((a, b) => b[1].winRate - a[1].winRate)[0]?.[0] ?? 'STRONG_BUY';

    // Best regime
    const regimeMap: Record<string, LabelStats> = {};
    for (const p of pairs) {
      for (const [regime, stats] of Object.entries(p.byRegime)) {
        if (!regimeMap[regime]) regimeMap[regime] = { trades: 0, wins: 0, losses: 0, winRate: 0, avgPnl: 0 };
        regimeMap[regime].trades += stats.trades;
        regimeMap[regime].wins += stats.wins;
      }
    }
    for (const s of Object.values(regimeMap)) s.winRate = s.trades > 0 ? s.wins / s.trades : 0;
    const bestRegime = Object.entries(regimeMap)
      .sort((a, b) => b[1].winRate - a[1].winRate)[0]?.[0] ?? 'trending';

    // Suggest thresholds: find the score band with best win rate
    const bandMap: Record<string, LabelStats> = {};
    for (const p of pairs) {
      for (const [band, stats] of Object.entries(p.byScoreBand)) {
        if (!bandMap[band]) bandMap[band] = { trades: 0, wins: 0, losses: 0, winRate: 0, avgPnl: 0 };
        bandMap[band].trades += stats.trades;
        bandMap[band].wins += stats.wins;
      }
    }
    for (const s of Object.values(bandMap)) s.winRate = s.trades > 0 ? s.wins / s.trades : 0;
    const bestBand = Object.entries(bandMap)
      .filter(([, s]) => s.trades >= 3)
      .sort((a, b) => b[1].winRate - a[1].winRate)[0]?.[0] ?? '72-80';
    const suggestedEnter = bestBand === '80+' ? 80 : bestBand === '72-80' ? 72 : bestBand === '65-72' ? 65 : 58;

    return {
      totalTrades: allTrades.length,
      winRate: allTrades.length > 0 ? wins.length / allTrades.length : 0,
      avgPnlPct: allTrades.length > 0 ? totalPnl / allTrades.length : 0,
      bestLabel,
      bestRegime,
      suggestedThresholds: {
        enter: suggestedEnter,
        profitTargetExitScore: 45,
        drawdownExitScore: 32,
      },
    };
  }
}
