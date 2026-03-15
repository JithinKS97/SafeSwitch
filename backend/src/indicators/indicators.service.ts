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
    const adx14 = this.adx(candles, 14);
    const adxTrend: 'trending' | 'ranging' = adx14 >= 25 ? 'trending' : 'ranging';
    const volumeRatio = this.volumeRatio(candles);

    const { slope: trendSlope, r2: trendR2, predictedNext } = this.linearRegression(closes, 50);
    const { support: supportLevel, resistance: resistanceLevel } = this.swingLevels(candles, 5);
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
        adx14: +adx14.toFixed(2),
        adxTrend,
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

  /** Enrich a 1h worksheet with 4h context computed from 4h candles. */
  enrich4h(ws: PairWorksheet, candles4h: Candle[]): PairWorksheet {
    const closes4h = candles4h.map((c) => c.close);
    const ema20_4h = this.ema(closes4h, 20);
    const ema50_4h = this.ema(closes4h, 50);
    const trend4h: 'bullish' | 'bearish' | 'neutral' =
      ema20_4h > ema50_4h * 1.001 ? 'bullish' : ema20_4h < ema50_4h * 0.999 ? 'bearish' : 'neutral';
    const adx4h = this.adx(candles4h, 14);

    return {
      ...ws,
      context: {
        trend4h,
        adx4h: +adx4h.toFixed(2),
        ema20_4h: +ema20_4h.toFixed(4),
        ema50_4h: +ema50_4h.toFixed(4),
      },
    };
  }

  /** Extract compact snapshot from a worksheet for attaching to a journal entry. */
  snapshot(ws: PairWorksheet): EntryMathSnapshot {
    return {
      price: ws.price,
      rsi14: ws.indicators.rsi14,
      emaTrend: ws.indicators.emaTrend,
      adxTrend: ws.indicators.adxTrend,
      macdHistogram: ws.indicators.macdHistogram,
      bbPosition: ws.indicators.bbPosition,
      trendSlope: ws.model.trendSlope,
      trendR2: ws.model.trendR2,
      volatilityPct: ws.model.volatilityPct,
      trend4h: ws.context?.trend4h,
    };
  }

  // ─── Indicator implementations ──────────────────────────────────────────────

  private rsi(closes: number[], period = 14): number {
    if (closes.length < period + 1) return 50;
    // Wilder's smoothed RSI over full series for accuracy
    const changes = closes.slice(1).map((c, i) => c - closes[i]);
    let avgGain = changes.slice(0, period).filter((d) => d > 0).reduce((s, d) => s + d, 0) / period;
    let avgLoss = changes.slice(0, period).filter((d) => d < 0).reduce((s, d) => s - d, 0) / period;
    for (const d of changes.slice(period)) {
      avgGain = (avgGain * (period - 1) + Math.max(0, d)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.max(0, -d)) / period;
    }
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
    if (closes.length < 35) return zero;
    const ema12 = this.emaArray(closes, 12);
    const ema26 = this.emaArray(closes, 26);
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
      return Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
    });
    // Wilder's smoothed ATR
    const slice = trs.slice(-Math.min(trs.length, period * 3));
    let atr = slice.slice(0, period).reduce((s, tr) => s + tr, 0) / period;
    for (const tr of slice.slice(period)) {
      atr = (atr * (period - 1) + tr) / period;
    }
    return atr;
  }

  /**
   * Wilder's ADX(14) — measures trend strength, not direction.
   * ADX > 25: trending market. ADX < 20: ranging/choppy.
   */
  private adx(candles: Candle[], period = 14): number {
    if (candles.length < period * 2 + 1) return 15; // default to ranging when insufficient data
    const slice = candles.slice(-(period * 3 + 1));

    const plusDMs: number[] = [];
    const minusDMs: number[] = [];
    const trs: number[] = [];

    for (let i = 1; i < slice.length; i++) {
      const curr = slice[i];
      const prev = slice[i - 1];
      const upMove = curr.high - prev.high;
      const downMove = prev.low - curr.low;
      plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
      minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);
      trs.push(Math.max(curr.high - curr.low, Math.abs(curr.high - prev.close), Math.abs(curr.low - prev.close)));
    }

    // Wilder's smoothing
    let smoothTR = trs.slice(0, period).reduce((s, v) => s + v, 0);
    let smoothPlus = plusDMs.slice(0, period).reduce((s, v) => s + v, 0);
    let smoothMinus = minusDMs.slice(0, period).reduce((s, v) => s + v, 0);

    const dxValues: number[] = [];
    for (let i = period; i < trs.length; i++) {
      smoothTR = smoothTR - smoothTR / period + trs[i];
      smoothPlus = smoothPlus - smoothPlus / period + plusDMs[i];
      smoothMinus = smoothMinus - smoothMinus / period + minusDMs[i];
      const diPlus = smoothTR > 0 ? (smoothPlus / smoothTR) * 100 : 0;
      const diMinus = smoothTR > 0 ? (smoothMinus / smoothTR) * 100 : 0;
      const diSum = diPlus + diMinus;
      dxValues.push(diSum > 0 ? (Math.abs(diPlus - diMinus) / diSum) * 100 : 0);
    }

    if (dxValues.length < period) return 15;
    // Wilder's smooth ADX from DX values
    let adxVal = dxValues.slice(0, period).reduce((s, v) => s + v, 0) / period;
    for (const dx of dxValues.slice(period)) {
      adxVal = (adxVal * (period - 1) + dx) / period;
    }
    return adxVal;
  }

  /**
   * Swing pivot support and resistance.
   * A swing high is a candle whose high exceeds the N candles on either side.
   * A swing low is a candle whose low is below the N candles on either side.
   * Returns the most recent significant swing high (resistance) and swing low (support).
   * Falls back to 50-candle range min/max if no pivots are found.
   */
  private swingLevels(candles: Candle[], n = 5): { support: number; resistance: number } {
    const price = candles[candles.length - 1]?.close ?? 0;
    // Only look at last 100 candles (enough history, not too noisy)
    const slice = candles.slice(-100);
    const len = slice.length;

    let resistance = 0;
    let support = Infinity;

    // Walk backwards so we find the most recent pivots first
    for (let i = len - n - 1; i >= n; i--) {
      const c = slice[i];
      // Swing high
      if (resistance === 0) {
        const isSwingHigh = slice.slice(i - n, i).every((x) => x.high <= c.high) &&
          slice.slice(i + 1, i + n + 1).every((x) => x.high <= c.high);
        if (isSwingHigh && c.high > price * 0.98) {
          resistance = c.high;
        }
      }
      // Swing low
      if (support === Infinity) {
        const isSwingLow = slice.slice(i - n, i).every((x) => x.low >= c.low) &&
          slice.slice(i + 1, i + n + 1).every((x) => x.low >= c.low);
        if (isSwingLow && c.low < price * 1.02) {
          support = c.low;
        }
      }
      if (resistance !== 0 && support !== Infinity) break;
    }

    // Fallback to range min/max if no pivots found
    const fallbackCandles = candles.slice(-50);
    if (resistance === 0) resistance = Math.max(...fallbackCandles.map((c) => c.high));
    if (support === Infinity) support = Math.min(...fallbackCandles.map((c) => c.low));

    return { support, resistance };
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
    lookback = 50,
  ): { slope: number; r2: number; predictedNext: number } {
    const values = closes.slice(-lookback);
    const n = values.length;
    if (n < 2) return { slope: 0, r2: 0, predictedNext: values[0] ?? 0 };

    const xMean = (n - 1) / 2;
    const yMean = values.reduce((s, v) => s + v, 0) / n;

    let ssXX = 0, ssXY = 0, ssYY = 0;
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
