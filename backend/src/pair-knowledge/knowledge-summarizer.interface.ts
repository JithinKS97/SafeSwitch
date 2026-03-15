/**
 * Knowledge Summarizer — produces a short summary of what the agent has learned about a pair.
 *
 * The summary is a representation of the agent's understanding / confidence in its knowledge.
 * Swap implementations to improve the summarization approach.
 */

export type JournalEntryForSummary = {
  action: string
  reasoning: string
  outcome: { pnl: number; closeReason: string } | null
}

export const KNOWLEDGE_SUMMARIZER = Symbol('KnowledgeSummarizer')

export interface KnowledgeSummarizer {
  /**
   * Produce a short summary (1-3 sentences) of what the agent has learned about this pair
   * from the given journal entries. Represents the agent's understanding / confidence.
   */
  summarise(pair: string, entries: JournalEntryForSummary[], confidence: number, userId: string): Promise<string>
}
