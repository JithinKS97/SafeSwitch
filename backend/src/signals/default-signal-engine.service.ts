import { Injectable } from '@nestjs/common';
import type { PairWorksheet } from '../indicators/indicators.types';
import type { SignalEngine } from './signal-engine.interface';
import type { PairSignal, SignalComponents, SignalLabel } from './signal.types';

/**
 * Default signal engine — pure math, no AI.
 *
 * ADX-based regime detection gates which component weights apply:
 *   TRENDING (ADX ≥ 25): trend + momentum dominate
 *   RANGING  (ADX < 20): oscillator + position dominate
 *
 * 4h context (when present) gates the final score:
 *   A LONG signal in a 4h bearish trend is penalised.
 *   A SHORT signal in a 4h bullish trend is penalised.
 *   Strong 4h ADX amplifies the penalty/bonus.
 */
@Injectable()
export class DefaultSignalEngineService implements SignalEngine {
  score(pair: string, ws: PairWorksheet, direction: 'LONG' | 'SHORT'): PairSignal {
    const components = this.computeComponents(ws, direction);
    const raw = this.weightedScore(ws, components);
    const score = this.apply4hGate(raw, ws, direction);
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
   * Weighted score adapts based on ADX regime:
   *   Trending: trend(30%) momentum(25%) oscillator(15%) model(20%) volume(10%)
   *   Ranging:  trend(15%) momentum(15%) oscillator(30%) model(25%) volume(15%)
   */
  private weightedScore(ws: PairWorksheet, c: SignalComponents): number {
    const adx = ws.indicators.adx14;
    let weights: { trend: number; momentum: number; oscillator: number; model: number; volume: number };

    if (adx >= 25) {
      // Trending regime — trend and momentum drive the signal
      weights = { trend: 0.30, momentum: 0.25, oscillator: 0.15, model: 0.20, volume: 0.10 };
    } else if (adx < 20) {
      // Ranging regime — oscillators and model position matter more
      weights = { trend: 0.15, momentum: 0.15, oscillator: 0.30, model: 0.25, volume: 0.15 };
    } else {
      // Transition zone — balanced weights
      weights = { trend: 0.22, momentum: 0.20, oscillator: 0.23, model: 0.22, volume: 0.13 };
    }

    const raw =
      c.trend * weights.trend +
      c.momentum * weights.momentum +
      c.oscillator * weights.oscillator +
      c.model * weights.model +
      c.volume * weights.volume;
    return Math.round(Math.max(0, Math.min(100, raw)));
  }

  /**
   * 4h timeframe gate.
   * If 4h trend opposes the trade direction, penalise by up to 18 points.
   * Strong 4h ADX increases the penalty. Aligned 4h trend adds a bonus.
   */
  private apply4hGate(score: number, ws: PairWorksheet, dir: 'LONG' | 'SHORT'): number {
    const ctx = ws.context;
    if (!ctx) return score;

    const { trend4h, adx4h } = ctx;
    const adxFactor = Math.min(1, adx4h / 40); // scales 0→1 as ADX goes 0→40

    const isAligned = (dir === 'LONG' && trend4h === 'bullish') || (dir === 'SHORT' && trend4h === 'bearish');
    const isOpposed = (dir === 'LONG' && trend4h === 'bearish') || (dir === 'SHORT' && trend4h === 'bullish');

    if (isOpposed) {
      const penalty = Math.round(8 + 10 * adxFactor); // 8–18 points
      return Math.max(0, score - penalty);
    }
    if (isAligned) {
      const bonus = Math.round(3 + 5 * adxFactor); // 3–8 points
      return Math.min(100, score + bonus);
    }
    return score; // neutral 4h
  }

  /**
   * EMA trend alignment.
   * bullish EMA cross → LONG gets high score; bearish → SHORT gets high score.
   */
  private trendScore(ws: PairWorksheet, dir: 'LONG' | 'SHORT'): number {
    const { emaTrend, ema20, ema50 } = ws.indicators;
    const gap = ema50 > 0 ? Math.abs(ema20 - ema50) / ema50 : 0;
    const gapConviction = Math.min(gap / 0.03, 1); // 3% spread = full conviction

    if (emaTrend === 'bullish') {
      return dir === 'LONG' ? Math.round(60 + 40 * gapConviction) : Math.round(20 - 15 * gapConviction);
    }
    if (emaTrend === 'bearish') {
      return dir === 'SHORT' ? Math.round(60 + 40 * gapConviction) : Math.round(20 - 15 * gapConviction);
    }
    return 45; // neutral
  }

  /**
   * MACD momentum — histogram direction and magnitude.
   */
  private momentumScore(ws: PairWorksheet, dir: 'LONG' | 'SHORT'): number {
    const { macdHistogram, macdLine } = ws.indicators;
    const scale = Math.abs(macdLine) > 0 ? Math.abs(macdLine) : 1;
    const normalized = Math.max(-1, Math.min(1, macdHistogram / scale));
    const bullishPct = (normalized + 1) / 2;
    return dir === 'LONG'
      ? Math.round(20 + 70 * bullishPct)
      : Math.round(90 - 70 * bullishPct);
  }

  /**
   * RSI + Bollinger Band position.
   * For LONG: low RSI (oversold) and low BB position are ideal.
   * For SHORT: high RSI (overbought) and high BB position are ideal.
   */
  private oscillatorScore(ws: PairWorksheet, dir: 'LONG' | 'SHORT'): number {
    const { rsi14, bbPosition } = ws.indicators;
    const rsiNorm = rsi14 / 100;
    const rsiScore = dir === 'LONG' ? 1 - rsiNorm : rsiNorm;

    let extremeBonus = 0;
    if (dir === 'LONG' && rsi14 < 30) extremeBonus = ((30 - rsi14) / 30) * 0.2;
    if (dir === 'SHORT' && rsi14 > 70) extremeBonus = ((rsi14 - 70) / 30) * 0.2;

    const bbScore = dir === 'LONG' ? 1 - bbPosition : bbPosition;
    const combined = rsiScore * 0.6 + bbScore * 0.4 + extremeBonus;
    return Math.round(Math.min(100, combined * 100));
  }

  /**
   * Linear regression model — slope alignment, R² confidence, price vs predicted,
   * and distance to swing support/resistance.
   */
  private modelScore(ws: PairWorksheet, dir: 'LONG' | 'SHORT'): number {
    const { trendSlope, trendR2, predictedNext, supportLevel, resistanceLevel } = ws.model;
    const price = ws.price;

    const slopeAligned = dir === 'LONG' ? trendSlope > 0 : trendSlope < 0;
    const baseSlope = slopeAligned ? 65 : 35;
    const r2Boost = trendR2 * 20; // up to +20 for perfect regression fit

    // Price vs predicted
    const priceEdge = price > 0 ? (predictedNext - price) / price : 0;
    const edgeScore = dir === 'LONG' ? priceEdge : -priceEdge;
    const edgeBoost = Math.max(-10, Math.min(10, edgeScore * 200));

    // Distance to swing S/R (swing pivots are more meaningful than range min/max)
    const range = resistanceLevel - supportLevel;
    let proximityScore = 0;
    if (range > 0) {
      const posInRange = (price - supportLevel) / range; // 0=at support, 1=at resistance
      proximityScore = dir === 'LONG' ? (1 - posInRange) * 8 : posInRange * 8;
    }

    return Math.round(Math.max(0, Math.min(100, baseSlope + r2Boost + edgeBoost + proximityScore)));
  }

  /**
   * Volume confirmation — direction-agnostic, amplifies conviction.
   */
  private volumeScore(ws: PairWorksheet): number {
    const { volumeRatio } = ws.indicators;
    if (volumeRatio >= 2.0) return 90;
    if (volumeRatio >= 1.5) return 75;
    if (volumeRatio >= 1.0) return 60;
    if (volumeRatio >= 0.7) return 45;
    return 30;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

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
    const { rsi14, emaTrend, macdHistogram, bbPosition, volumeRatio, adx14, adxTrend } = ws.indicators;
    const { trendSlope, trendR2 } = ws.model;
    const ctx = ws.context;

    const parts: string[] = [];

    parts.push(`ADX ${adx14.toFixed(0)} (${adxTrend})`);

    if (c.trend >= 65) parts.push(`EMA ${emaTrend} — aligned`);
    else if (c.trend <= 35) parts.push(`EMA ${emaTrend} — opposed`);
    else parts.push('EMA neutral');

    if (rsi14 < 30) parts.push(`RSI oversold (${rsi14})`);
    else if (rsi14 > 70) parts.push(`RSI overbought (${rsi14})`);
    else parts.push(`RSI ${rsi14}`);

    parts.push(
      macdHistogram > 0
        ? `MACD +${macdHistogram.toFixed(4)} (bullish)`
        : `MACD ${macdHistogram.toFixed(4)} (bearish)`,
    );

    const bbPct = Math.round(bbPosition * 100);
    if (bbPct <= 20) parts.push('near lower band');
    else if (bbPct >= 80) parts.push('near upper band');

    parts.push(`slope ${trendSlope > 0 ? '+' : ''}${trendSlope.toFixed(4)} R²=${trendR2.toFixed(2)}`);

    if (volumeRatio >= 1.5) parts.push(`vol ${volumeRatio.toFixed(1)}x`);

    if (ctx) {
      const gate = ctx.trend4h === (dir === 'LONG' ? 'bearish' : 'bullish') ? '⚠ 4h opposed' :
        ctx.trend4h === (dir === 'LONG' ? 'bullish' : 'bearish') ? '✓ 4h aligned' : '4h neutral';
      parts.push(gate);
    }

    return `Score ${score}/100 ${dir}: ${parts.join(' | ')}`;
  }
}
