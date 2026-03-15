/**
 * Pair Knowledge — proprietary module for confidence + knowledge building per pair.
 *
 * This interface defines the contract. Implementations can be swapped or improved
 * without changing the rest of the application.
 */

export type JournalEntry = {
  id: string
  cycleNum: number
  action: 'ENTER' | 'EXIT'
  reasoning: string
  outcome: { pnl: number; closeReason: string } | null
  createdAt: Date
}

export type PairJournalData = {
  id: string
  pair: string
  confidence: number
  summarisedKnowledge: string
  entries: JournalEntry[]
  updatedAt: Date
}

export const PAIR_KNOWLEDGE_ENGINE = Symbol('PairKnowledgeEngine')

export interface PairKnowledgeEngine {
  /**
   * Record a position change (enter or exit) for a pair.
   * On EXIT, confidence is recalculated.
   */
  addEntry(
    userId: string,
    pair: string,
    cycleNum: number,
    action: 'ENTER' | 'EXIT',
    reasoning: string,
    outcome?: { pnl: number; closeReason: string },
  ): Promise<void>

  /**
   * Get all pair journals for a user.
   */
  findForUser(userId: string): Promise<PairJournalData[]>

  /**
   * Get journal for a specific pair.
   */
  findByPair(userId: string, pair: string): Promise<PairJournalData | null>

  /**
   * Get journals for multiple pairs (e.g. for agent prompt).
   */
  findForPairs(userId: string, pairs: string[]): Promise<PairJournalData[]>
}
