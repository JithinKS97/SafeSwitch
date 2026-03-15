import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import type { KnowledgeSummarizer, JournalEntryForSummary } from './knowledge-summarizer.interface';

@Injectable()
export class DefaultKnowledgeSummarizerService implements KnowledgeSummarizer {
  private readonly logger = new Logger(DefaultKnowledgeSummarizerService.name);

  constructor(private readonly ai: AiService) {}

  async summarise(
    pair: string,
    entries: JournalEntryForSummary[],
    confidence: number,
    userId: string,
  ): Promise<string> {
    if (entries.length === 0) return '';

    try {
      const entriesText = entries
        .map((e) => {
          const line = `${e.action}: ${e.reasoning}`;
          const o = e.outcome as { pnl?: number; closeReason?: string; price?: number } | null;
          if (o?.pnl != null && o?.closeReason != null) {
            return `${line} → ${o.pnl >= 0 ? '+' : ''}${o.pnl.toFixed(2)}% (${o.closeReason})`;
          }
          if (o?.price != null) return `${line} [price: ${o.price}]`;
          return line;
        })
        .join('\n');

      const exitCount = entries.filter((e) => e.action === 'EXIT').length;

      const prompt = `You are summarizing what a trading agent has learned about ${pair} from its paper trades.

Journal entries (enter/exit with reasoning and outcomes):
${entriesText}

Current confidence score: ${confidence.toFixed(0)}%
Number of completed trades (EXITs): ${exitCount}

Write 2-4 concise sentences that capture what the agent thinks it has learned about this pair. Include:
- Its understanding and any patterns it believes work (if any)
- How confident it feels (or that it feels less confident if score is low)
- Whether it thinks more trades are needed to form a clearer view (especially when confidence is low or few trades completed)

Write in third person ("The agent has learned...", "The agent feels..."). Be specific and factual. No fluff.`;

      const raw = await this.ai.complete(prompt, userId);
      return raw.trim().slice(0, 1000); // cap length
    } catch (err) {
      this.logger.warn(`Knowledge summarization failed: ${(err as Error).message}`);
      return '';
    }
  }
}
