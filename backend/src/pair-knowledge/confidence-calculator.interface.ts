/**
 * Confidence Calculator — proprietary formula for deriving confidence from outcomes.
 *
 * Swap implementations to improve the confidence model without changing
 * the rest of the pair knowledge module.
 */

export type Outcome = {
  pnl: number
  closeReason: string
}

export const CONFIDENCE_CALCULATOR = Symbol('ConfidenceCalculator')

export interface ConfidenceCalculator {
  /**
   * Compute confidence (0–100) from a list of exit outcomes.
   */
  calculate(outcomes: Outcome[]): number
}
