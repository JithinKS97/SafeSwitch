import { Injectable } from '@nestjs/common';
import type { PairWorksheet } from '../indicators/indicators.types';
import type { SignalEngine } from './signal-engine.interface';
import type { PairSignal, SignalComponents, SignalLabel } from './signal.types';

/**
 * Default signal engine — pure math, no AI.
 *
 * Each component is scored 0–100 for the requested direction.
 * Weights:
 *   trend (EMA alignment)   25 %
 *   momentum (MACD)         20 %
 *   oscillator (RSI + BB)   20 %
 *   model (regression)      20 %
 *   volume confirmation     15 %
 */
@Injectable()
export class DefaultSignalEngineService implements SignalEngine {
  private readonly weights = {
    trend: 0.25,
    momentum: 0.20,
    oscillator: 0.20,
    model: 0.20,
    volume: 0.15,
  } as const;

  score(pair: string, ws: PairWorksheet, direction: 'LONG' | 'SHORT'): PairSignal {
    const components = this.computeComponents(ws, direction);
    const score = this.weightedScore(components);
    const label = this.toLabel(score);
    const summary = this.buildSummary(ws, components, score, direction);
    return { pair, direction, score, components, label, summary };
  }

  scoreAll(worksheets: Map<string, PairWorksheet>): PairSignal[] {
    const results: PairSignal[] = [];
    for (const [pair, ws] of worksheets) {
      const long = this.score(pair, ws, 'LONG');
      const short = this.score(pair, ws, 'SHORT');
      results.push(long.score >= short.score ? long : short);
    }
    return results.sort((a, b) => b.score - a.score);
  }

  // ─── Component scorers ───────────────────────────────────────────────────────

  private computeComponents(ws: PairWorksheet, dir: 'LONG' | 'SHORT'): SignalComponents {
    return {
      trend: this.trendScore(ws, dir),
      momentum: this.momentumScore(ws, dir),
      oscillator: this.oscillatorScore(ws, dir),
      model: this.modelScore(ws, dir),
      volume: this.volumeScore(ws),
    };
  }

  /**
   * EMA trend alignment.
   * bullish EMA cross → LONG gets high score; bearish → SHORT gets high score.
   * Near-zero score in the opposing direction discourages counter-trend trades.
   */
  private trendScore(ws: PairWorksheet, dir: 'LONG' | 'SHORT'): number {
    const { emaTrend, ema20, ema50 } = ws.indicators;
    // How far apart are the EMAs as a % of price?
    const gap = ema50 > 0 ? Math.abs(ema20 - ema50) / ema50 : 0;
    // Cap gap contribution at 3% spread = full conviction
    const gapConviction = Math.min(gap / 0.03, 1);

    if (emaTrend === 'bullish') {
      return dir === 'LONG' ? 60 + 40 * gapConviction : 20 - 15 * gapConviction;
    }
    if (emaTrend === 'bearish') {
      return dir === 'SHORT' ? 60 + 40 * gapConviction : 20 - 15 * gapConviction;
    }
    // neutral
    return 45;
  }

  /**
   * MACD momentum.
   * Histogram direction and magnitude relative to a reference scale.
   */
  private momentumScore(ws: PairWorksheet, dir: 'LONG' | 'SHORT'): number {
    const { macdHistogram, macdLine } = ws.indicators;
    // Normalise histogram against |macdLine| as a scale proxy (capped)
    const scale = Math.abs(macdLine) > 0 ? Math.abs(macdLine) : 1;
    const normalized = Math.max(-1, Math.min(1, macdHistogram / scale));

    // normalized: +1 = strong bullish momentum, -1 = strong bearish momentum
    const bullishPct = (normalized + 1) / 2; // 0–1
    return dir === 'LONG'
      ? Math.round(20 + 70 * bullishPct)
      : Math.round(90 - 70 * bullishPct);
  }

  /**
   * RSI + Bollinger Band position combined.
   * For LONG: low RSI (oversold) and low BB position (near lower band) are ideal.
   * For SHORT: high RSI (overbought) and high BB position (near upper band) are ideal.
   */
  private oscillatorScore(ws: PairWorksheet, dir: 'LONG' | 'SHORT'): number {
    const { rsi14, bbPosition } = ws.indicators;

    // RSI component (0–1): long favours low RSI, short favours high RSI
    const rsiNorm = rsi14 / 100;
    const rsiScore = dir === 'LONG' ? 1 - rsiNorm : rsiNorm;

    // Extreme RSI bonus: <30 is very oversold (great for long), >70 is very overbought (great for short)
    let extremeBonus = 0;
    if (dir === 'LONG' && rsi14 < 30) extremeBonus = (30 - rsi14) / 30 * 0.2;
    if (dir === 'SHORT' && rsi14 > 70) extremeBonus = (rsi14 - 70) / 30 * 0.2;

    // BB position component (0–1)
    const bbScore = dir === 'LONG' ? 1 - bbPosition : bbPosition;

    const combined = (rsiScore * 0.6 + bbScore * 0.4 + extremeBonus);
    return Math.round(Math.min(100, combined * 100));
  }

  /**
   * Linear regression model.
   * Slope direction alignment + R² confidence weight.
   */
  private modelScore(ws: PairWorksheet, dir: 'LONG' | 'SHORT'): number {
    const { trendSlope, trendR2, predictedNext, supportLevel, resistanceLevel } = ws.model;
    const price = ws.price;

    // Slope alignment
    const slopeAligned = dir === 'LONG' ? trendSlope > 0 : trendSlope < 0;
    const baseSlope = slopeAligned ? 65 : 35;

    // R² confidence: high R² means the trend is reliable
    const r2Boost = trendR2 * 20; // up to +20 for perfect fit

    // Price vs predicted: if predicted > price, bullish edge
    const priceEdge = price > 0 ? (predictedNext - price) / price : 0;
    const edgeScore = dir === 'LONG' ? priceEdge : -priceEdge;
    const edgeBoost = Math.max(-10, Math.min(10, edgeScore * 200));

    // Distance to support/resistance
    const range = resistanceLevel - supportLevel;
    let proximityScore = 0;
    if (range > 0) {
      const posInRange = (price - supportLevel) / range; // 0 = at support, 1 = at resistance
      proximityScore = dir === 'LONG' ? (1 - posInRange) * 5 : posInRange * 5;
    }

    return Math.round(Math.max(0, Math.min(100, baseSlope + r2Boost + edgeBoost + proximityScore)));
  }

  /**
   * Volume confirmation.
   * High volume ratio amplifies any directional signal; low volume reduces conviction.
   * This score is direction-agnostic — it boosts conviction regardless of direction.
   */
  private volumeScore(ws: PairWorksheet): number {
    const { volumeRatio } = ws.indicators;
    // volumeRatio: 1 = average, >1 = above average, <1 = below average
    if (volumeRatio >= 2.0) return 90;
    if (volumeRatio >= 1.5) return 75;
    if (volumeRatio >= 1.0) return 60;
    if (volumeRatio >= 0.7) return 45;
    return 30;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private weightedScore(c: SignalComponents): number {
    const raw =
      c.trend * this.weights.trend +
      c.momentum * this.weights.momentum +
      c.oscillator * this.weights.oscillator +
      c.model * this.weights.model +
      c.volume * this.weights.volume;
    return Math.round(Math.max(0, Math.min(100, raw)));
  }

  private toLabel(score: number): SignalLabel {
    if (score >= 78) return 'STRONG_BUY';
    if (score >= 62) return 'BUY';
    if (score >= 40) return 'NEUTRAL';
    if (score >= 25) return 'SELL';
    return 'STRONG_SELL';
  }

  private buildSummary(
    ws: PairWorksheet,
    c: SignalComponents,
    score: number,
    dir: 'LONG' | 'SHORT',
  ): string {
    const { rsi14, emaTrend, macdHistogram, bbPosition, volumeRatio } = ws.indicators;
    const { trendSlope, trendR2 } = ws.model;

    const parts: string[] = [];

    // Trend
    if (c.trend >= 65) parts.push(`EMA ${emaTrend} — trend aligned for ${dir}`);
    else if (c.trend <= 35) parts.push(`EMA ${emaTrend} — trend opposes ${dir}`);
    else parts.push('EMA neutral');

    // RSI
    if (rsi14 < 30) parts.push(`RSI oversold (${rsi14})`);
    else if (rsi14 > 70) parts.push(`RSI overbought (${rsi14})`);
    else parts.push(`RSI ${rsi14}`);

    // MACD
    parts.push(
      macdHistogram > 0
        ? `MACD +${macdHistogram.toFixed(4)} (bullish momentum)`
        : `MACD ${macdHistogram.toFixed(4)} (bearish momentum)`,
    );

    // Bollinger
    const bbPct = Math.round(bbPosition * 100);
    if (bbPct <= 20) parts.push('price near lower Bollinger band');
    else if (bbPct >= 80) parts.push('price near upper Bollinger band');

    // Regression
    parts.push(
      `regression slope ${trendSlope > 0 ? '+' : ''}${trendSlope.toFixed(4)} (R²=${trendR2.toFixed(2)})`,
    );

    // Volume
    if (volumeRatio >= 1.5) parts.push(`volume ${volumeRatio.toFixed(1)}x avg`);

    return `Score ${score}/100 ${dir}: ${parts.join(' | ')}`;
  }
}
