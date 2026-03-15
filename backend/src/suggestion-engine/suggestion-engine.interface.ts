/**
 * Suggestion Engine — proprietary module for generating trading pair suggestions.
 *
 * This interface defines the contract. Implementations can be swapped or improved
 * without changing the rest of the application.
 */

export type RiskAppetite = 'LOW' | 'MEDIUM' | 'HIGH'

export type TradeDirection = 'LONG' | 'SHORT'

export type MarketDataPoint = {
  pair: string
  price: number
  change24h: number
  volume24h: number
}

export type ScoredMarketDataPoint = MarketDataPoint & {
  /** Pre-computed signal score 0–100. Present when candles were available. */
  signalScore?: number
  signalDirection?: TradeDirection
  signalLabel?: string
  signalSummary?: string
}

export type SuggestionInput = {
  riskPct: number
  riskAppetite: RiskAppetite
  /** Market data, optionally pre-ranked by signal score (highest first). */
  marketData: ScoredMarketDataPoint[]
}

export type SuggestionItem = {
  pair: string
  direction: TradeDirection
  duration: string
  reason: string
  riskLevel: RiskAppetite
}

export type SuggestionOutput = {
  analysis: string
  suggestions: SuggestionItem[]
}

export const SUGGESTION_ENGINE = Symbol('SuggestionEngine')

export interface SuggestionEngine {
  /**
   * Generate trading pair suggestions from market data and risk appetite.
   * Implementations may use AI, rules, or hybrid approaches.
   */
  suggest(input: SuggestionInput): Promise<SuggestionOutput>
}
