import type { PairWorksheet } from '../indicators/indicators.types'
import type { PairSignal } from './signal.types'

export const SIGNAL_ENGINE = Symbol('SignalEngine')

export interface SignalEngine {
  /**
   * Score a single pair in a given direction.
   * Returns a conviction score 0–100 derived purely from the worksheet math —
   * no AI involved; the LLM can then explain the signal in plain language.
   */
  score(pair: string, worksheet: PairWorksheet, direction: 'LONG' | 'SHORT'): PairSignal

  /**
   * Score every pair in the map for both directions and return the best
   * signal per pair (highest score wins the direction tie-break).
   * Results are sorted descending by score.
   */
  scoreAll(worksheets: Map<string, PairWorksheet>): PairSignal[]
}
