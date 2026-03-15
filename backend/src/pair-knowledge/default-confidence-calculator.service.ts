import { Injectable } from '@nestjs/common';
import type { ConfidenceCalculator, Outcome } from './confidence-calculator.interface';

/**
 * Default confidence formula.
 *
 * Replace this implementation to improve the model (e.g. add time in market,
 * drawdown recovery, consistency metrics).
 */
@Injectable()
export class DefaultConfidenceCalculatorService implements ConfidenceCalculator {
  calculate(outcomes: Outcome[]): number {
    const total = outcomes.length;
    if (total === 0) return 0;
    const wins = outcomes.filter((o) => o.pnl > 0).length;
    const winRate = wins / total;
    const avgPnl = outcomes.reduce((s, o) => s + o.pnl, 0) / total;
    return Math.min(100, Math.max(0, winRate * 60 + avgPnl * 2 + Math.min(total, 10) * 2));
  }
}
