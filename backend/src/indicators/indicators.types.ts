export type Candle = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type PairWorksheet = {
  updatedAtCycle: number
  price: number
  indicators: {
    rsi14: number                               // 0–100; >70 overbought, <30 oversold
    ema20: number                               // fast EMA
    ema50: number                               // slow EMA
    emaTrend: 'bullish' | 'bearish' | 'neutral' // ema20 vs ema50 relationship
    macdLine: number                            // EMA12 – EMA26
    macdSignal: number                          // EMA9 of MACD line
    macdHistogram: number                       // macdLine – macdSignal
    bbUpper: number                             // Bollinger upper band
    bbMiddle: number                            // Bollinger middle (SMA20)
    bbLower: number                             // Bollinger lower band
    bbPosition: number                          // 0 = at lower, 1 = at upper, 0.5 = middle
    atr14: number                               // Average True Range (absolute volatility)
    adx14: number                               // Trend strength 0–100 (>25 trending, <20 ranging)
    adxTrend: 'trending' | 'ranging'            // Regime label derived from ADX
    volumeRatio: number                         // current vol / 20-period avg vol
  }
  model: {
    trendSlope: number      // per-candle price change from linear regression
    trendR2: number         // regression fit quality 0–1
    predictedNext: number   // extrapolated next candle close price
    supportLevel: number    // most recent significant swing pivot low
    resistanceLevel: number // most recent significant swing pivot high
    volatilityPct: number   // ATR14 as percentage of current price
  }
  /** Optional higher-timeframe context, populated when 4h candles are available */
  context?: {
    trend4h: 'bullish' | 'bearish' | 'neutral'
    adx4h: number
    ema20_4h: number
    ema50_4h: number
  }
}

/** Compact snapshot attached to each journal entry — records what the indicators looked like at decision time */
export type EntryMathSnapshot = {
  price: number
  rsi14: number
  emaTrend: 'bullish' | 'bearish' | 'neutral'
  adxTrend: 'trending' | 'ranging'
  macdHistogram: number
  bbPosition: number
  trendSlope: number
  trendR2: number
  volatilityPct: number
  trend4h?: 'bullish' | 'bearish' | 'neutral'
}
