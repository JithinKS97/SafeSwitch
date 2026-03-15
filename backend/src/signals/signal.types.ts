export type SignalLabel = 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL'

export type SignalComponents = {
  /** EMA trend alignment score (0–100) */
  trend: number
  /** MACD momentum score (0–100) */
  momentum: number
  /** RSI + Bollinger oscillator score (0–100) */
  oscillator: number
  /** Volume confirmation score (0–100) */
  volume: number
  /** Regression model directional confidence (0–100) */
  model: number
}

export type PairSignal = {
  pair: string
  direction: 'LONG' | 'SHORT'
  /** Overall conviction score 0–100 (higher = stronger signal) */
  score: number
  components: SignalComponents
  label: SignalLabel
  /** Human-readable explanation of what drove the score */
  summary: string
}
