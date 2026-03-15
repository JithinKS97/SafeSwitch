import { Injectable } from '@nestjs/common';
import type { Candle, EntryMathSnapshot, PairWorksheet } from './indicators.types';

@Injectable()
export class IndicatorsService {
  /** Compute full mathematical worksheet for a pair from its candle history. */
  compute(cycleNum: number, candles: Candle[]): PairWorksheet {
    const closes = candles.map((c) => c.close);
    const price = closes[closes.length - 1] ?? 0;

    const rsi14 = this.rsi(closes, 14);
    const ema20 = this.ema(closes, 20);
    const ema50 = this.ema(closes, 50);
    const emaTrend: 'bullish' | 'bearish' | 'neutral' =
      ema20 > ema50 * 1.001 ? 'bullish' : ema20 < ema50 * 0.999 ? 'bearish' : 'neutral';

    const { macdLine, macdSignal, macdHistogram } = this.macd(closes);
    const { upper: bbUpper, middle: bbMiddle, lower: bbLower, bbPosition } = this.bollingerBands(closes);
    const atr14 = this.atr(candles, 14);
    const volumeRatio = this.volumeRatio(candles);

    const { slope: trendSlope, r2: trendR2, predictedNext } = this.linearRegression(closes, 20);
    const supportLevel = Math.min(...candles.slice(-20).map((c) => c.low));
    const resistanceLevel = Math.max(...candles.slice(-20).map((c) => c.high));
    const volatilityPct = price > 0 ? (atr14 / price) * 100 : 0;

    return {
      updatedAtCycle: cycleNum,
      price: +price.toFixed(4),
      indicators: {
        rsi14: +rsi14.toFixed(2),
        ema20: +ema20.toFixed(4),
        ema50: +ema50.toFixed(4),
        emaTrend,
        macdLine: +macdLine.toFixed(6),
        macdSignal: +macdSignal.toFixed(6),
        macdHistogram: +macdHistogram.toFixed(6),
        bbUpper: +bbUpper.toFixed(4),
        bbMiddle: +bbMiddle.toFixed(4),
        bbLower: +bbLower.toFixed(4),
        bbPosition: +bbPosition.toFixed(3),
        atr14: +atr14.toFixed(4),
        volumeRatio: +volumeRatio.toFixed(2),
      },
      model: {
        trendSlope: +trendSlope.toFixed(4),
        trendR2: +trendR2.toFixed(3),
        predictedNext: +predictedNext.toFixed(4),
        supportLevel: +supportLevel.toFixed(4),
        resistanceLevel: +resistanceLevel.toFixed(4),
        volatilityPct: +volatilityPct.toFixed(3),
      },
    };
  }

  /** Extract compact snapshot from a worksheet for attaching to a journal entry. */
  snapshot(ws: PairWorksheet): EntryMathSnapshot {
    return {
      price: ws.price,
      rsi14: ws.indicators.rsi14,
      emaTrend: ws.indicators.emaTrend,
      macdHistogram: ws.indicators.macdHistogram,
      bbPosition: ws.indicators.bbPosition,
      trendSlope: ws.model.trendSlope,
      trendR2: ws.model.trendR2,
      volatilityPct: ws.model.volatilityPct,
    };
  }

  // ─── Indicator implementations ──────────────────────────────────────────────

  private rsi(closes: number[], period = 14): number {
    if (closes.length < period + 1) return 50;
    const slice = closes.slice(-(period + 1));
    let gains = 0;
    let losses = 0;
    for (let i = 1; i < slice.length; i++) {
      const diff = slice[i] - slice[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    return 100 - 100 / (1 + avgGain / avgLoss);
  }

  private ema(closes: number[], period: number): number {
    if (closes.length === 0) return 0;
    if (closes.length < period) return closes[closes.length - 1];
    const k = 2 / (period + 1);
    let val = closes.slice(0, period).reduce((s, c) => s + c, 0) / period;
    for (const c of closes.slice(period)) {
      val = c * k + val * (1 - k);
    }
    return val;
  }

  /** Returns EMA series starting from the first valid value (index period-1). */
  private emaArray(values: number[], period: number): number[] {
    if (values.length < period) return values.slice();
    const k = 2 / (period + 1);
    const result: number[] = [];
    let val = values.slice(0, period).reduce((s, c) => s + c, 0) / period;
    result.push(val);
    for (const v of values.slice(period)) {
      val = v * k + val * (1 - k);
      result.push(val);
    }
    return result;
  }

  private macd(closes: number[]): { macdLine: number; macdSignal: number; macdHistogram: number } {
    const zero = { macdLine: 0, macdSignal: 0, macdHistogram: 0 };
    if (closes.length < 35) return zero; // need enough data for EMA26 + EMA9 of MACD
    const ema12 = this.emaArray(closes, 12); // length = closes.length - 11
    const ema26 = this.emaArray(closes, 26); // length = closes.length - 25
    // Align to the shorter ema26 series
    const offset = ema12.length - ema26.length;
    const macdSeries = ema26.map((v, i) => ema12[i + offset] - v);
    const signalSeries = this.emaArray(macdSeries, 9);
    const macdLine = macdSeries[macdSeries.length - 1];
    const macdSignal = signalSeries[signalSeries.length - 1];
    return { macdLine, macdSignal, macdHistogram: macdLine - macdSignal };
  }

  private bollingerBands(closes: number[], period = 20, mult = 2) {
    const price = closes[closes.length - 1] ?? 0;
    const slice = closes.slice(-period);
    if (slice.length < period) {
      return { upper: price, middle: price, lower: price, bbPosition: 0.5 };
    }
    const middle = slice.reduce((s, c) => s + c, 0) / period;
    const variance = slice.reduce((s, c) => s + Math.pow(c - middle, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    const upper = middle + mult * stdDev;
    const lower = middle - mult * stdDev;
    const bbPosition =
      upper === lower ? 0.5 : Math.max(0, Math.min(1, (price - lower) / (upper - lower)));
    return { upper, middle, lower, bbPosition };
  }

  private atr(candles: Candle[], period = 14): number {
    if (candles.length < 2) return 0;
    const trs = candles.slice(1).map((c, i) => {
      const prev = candles[i];
      return Math.max(
        c.high - c.low,
        Math.abs(c.high - prev.close),
        Math.abs(c.low - prev.close),
      );
    });
    const recent = trs.slice(-period);
    return recent.reduce((s, tr) => s + tr, 0) / recent.length;
  }

  private volumeRatio(candles: Candle[], period = 20): number {
    if (candles.length < 2) return 1;
    const recent = candles.slice(-period);
    const avgVol =
      recent.slice(0, -1).reduce((s, c) => s + c.volume, 0) / Math.max(1, recent.length - 1);
    const currentVol = candles[candles.length - 1].volume;
    return avgVol === 0 ? 1 : currentVol / avgVol;
  }

  private linearRegression(
    closes: number[],
    lookback = 20,
  ): { slope: number; r2: number; predictedNext: number } {
    const values = closes.slice(-lookback);
    const n = values.length;
    if (n < 2) return { slope: 0, r2: 0, predictedNext: values[0] ?? 0 };

    const xMean = (n - 1) / 2;
    const yMean = values.reduce((s, v) => s + v, 0) / n;

    let ssXX = 0;
    let ssXY = 0;
    let ssYY = 0;
    for (let i = 0; i < n; i++) {
      const dx = i - xMean;
      const dy = values[i] - yMean;
      ssXX += dx * dx;
      ssXY += dx * dy;
      ssYY += dy * dy;
    }

    const slope = ssXX === 0 ? 0 : ssXY / ssXX;
    const intercept = yMean - slope * xMean;
    const r2 = ssYY === 0 ? 1 : Math.max(0, Math.min(1, (ssXY * ssXY) / (ssXX * ssYY)));
    const predictedNext = intercept + slope * n;

    return { slope, r2, predictedNext };
  }
}
