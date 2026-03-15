/**
 * Pair Knowledge — proprietary module for confidence + knowledge building per pair.
 *
 * This interface defines the contract. Implementations can be swapped or improved
 * without changing the rest of the application.
 */

import type { EntryMathSnapshot, PairWorksheet } from '../indicators/indicators.types';

export type { EntryMathSnapshot, PairWorksheet };

export type JournalEntry = {
  id: string
  cycleNum: number
  action: 'ENTER' | 'EXIT' | 'OBSERVE'
  reasoning: string
  outcome: { pnl: number; closeReason: string } | { price: number } | null
  mathAnalysis: EntryMathSnapshot | null
  createdAt: Date
}

export type PairJournalData = {
  id: string
  pair: string
  confidence: number
  summarisedKnowledge: string
  worksheet: PairWorksheet | null
  entries: JournalEntry[]
  updatedAt: Date
}

export const PAIR_KNOWLEDGE_ENGINE = Symbol('PairKnowledgeEngine')

export interface PairKnowledgeEngine {
  /**
   * Record a position change (enter or exit) for a pair.
   * On EXIT, confidence is recalculated and knowledge is summarised.
   * mathAnalysis captures the indicator state at decision time.
   */
  addEntry(
    userId: string,
    pair: string,
    cycleNum: number,
    action: 'ENTER' | 'EXIT',
    reasoning: string,
    outcome?: { pnl: number; closeReason: string },
    mathAnalysis?: EntryMathSnapshot,
  ): Promise<void>

  /**
   * Record a price observation for a pair (no position change).
   * mathAnalysis captures what the indicators looked like at observation time.
   */
  addObservation(
    userId: string,
    pair: string,
    cycleNum: number,
    price: number,
    reasoning?: string,
    mathAnalysis?: EntryMathSnapshot,
  ): Promise<void>

  /**
   * Persist the latest computed mathematical worksheet for a pair.
   * Called each cycle after indicators are computed from fresh candles.
   */
  updateWorksheet(userId: string, pair: string, worksheet: PairWorksheet): Promise<void>

  /** Get all pair journals for a user. */
  findForUser(userId: string): Promise<PairJournalData[]>

  /** Get journal for a specific pair. */
  findByPair(userId: string, pair: string): Promise<PairJournalData | null>

  /** Get journals for multiple pairs (e.g. for agent prompt). */
  findForPairs(userId: string, pairs: string[]): Promise<PairJournalData[]>
}
