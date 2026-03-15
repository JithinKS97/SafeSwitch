import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  type JournalEntry,
  type PairKnowledgeEngine,
  type PairJournalData,
  type EntryMathSnapshot,
  type PairWorksheet,
} from './pair-knowledge.interface';
import { CONFIDENCE_CALCULATOR, type ConfidenceCalculator } from './confidence-calculator.interface';
import { KNOWLEDGE_SUMMARIZER, type KnowledgeSummarizer } from './knowledge-summarizer.interface';

@Injectable()
export class PairKnowledgeEngineService implements PairKnowledgeEngine {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CONFIDENCE_CALCULATOR) private readonly confidenceCalc: ConfidenceCalculator,
    @Inject(KNOWLEDGE_SUMMARIZER) private readonly summarizer: KnowledgeSummarizer,
  ) {}

  async addEntry(
    userId: string,
    pair: string,
    cycleNum: number,
    action: 'ENTER' | 'EXIT',
    reasoning: string,
    outcome?: { pnl: number; closeReason: string },
    mathAnalysis?: EntryMathSnapshot,
  ): Promise<void> {
    const journal = await this.prisma.pairJournal.upsert({
      where: { userId_pair: { userId, pair } },
      create: { userId, pair },
      update: {},
    });
    await this.prisma.pairJournalEntry.create({
      data: {
        pairJournalId: journal.id,
        cycleNum,
        action,
        reasoning,
        outcome: outcome ?? undefined,
        mathAnalysis: mathAnalysis ?? undefined,
      },
    });
    if (action === 'EXIT' && outcome) {
      await this.updateConfidence(journal.id);
    }
    await this.updateSummarisedKnowledge(journal.id, pair);
  }

  async addObservation(
    userId: string,
    pair: string,
    cycleNum: number,
    price: number,
    reasoning?: string,
    mathAnalysis?: EntryMathSnapshot,
  ): Promise<void> {
    const journal = await this.prisma.pairJournal.upsert({
      where: { userId_pair: { userId, pair } },
      create: { userId, pair },
      update: {},
    });
    await this.prisma.pairJournalEntry.create({
      data: {
        pairJournalId: journal.id,
        cycleNum,
        action: 'OBSERVE',
        reasoning: reasoning ?? `Price: ${price}`,
        outcome: { price },
        mathAnalysis: mathAnalysis ?? undefined,
      },
    });
    await this.updateSummarisedKnowledge(journal.id, pair);
  }

  async updateWorksheet(userId: string, pair: string, worksheet: PairWorksheet): Promise<void> {
    await this.prisma.pairJournal.upsert({
      where: { userId_pair: { userId, pair } },
      create: { userId, pair, worksheet: worksheet as object },
      update: { worksheet: worksheet as object },
    });
  }

  private async updateConfidence(pairJournalId: string): Promise<void> {
    const entries = await this.prisma.pairJournalEntry.findMany({
      where: { pairJournalId, action: 'EXIT' },
      orderBy: { createdAt: 'asc' },
    });
    const outcomes = entries
      .map((e) => e.outcome as { pnl: number; closeReason: string } | null)
      .filter((o): o is { pnl: number; closeReason: string } => o != null);
    const confidence = this.confidenceCalc.calculate(outcomes);
    await this.prisma.pairJournal.update({
      where: { id: pairJournalId },
      data: { confidence },
    });
  }

  private async updateSummarisedKnowledge(pairJournalId: string, pair: string): Promise<void> {
    const journal = await this.prisma.pairJournal.findUnique({
      where: { id: pairJournalId },
      include: { entries: { orderBy: { createdAt: 'asc' } } },
    });
    if (!journal || journal.entries.length === 0) return;

    const entriesForSummary = journal.entries.map((e) => ({
      action: e.action,
      reasoning: e.reasoning,
      outcome: e.outcome as { pnl: number; closeReason: string } | null,
    }));
    const summarisedKnowledge = await this.summarizer.summarise(
      pair,
      entriesForSummary,
      journal.confidence,
      journal.userId,
    );
    if (summarisedKnowledge) {
      await this.prisma.pairJournal.update({
        where: { id: pairJournalId },
        data: { summarisedKnowledge },
      });
    }
  }

  async findForUser(userId: string): Promise<PairJournalData[]> {
    const rows = await this.prisma.pairJournal.findMany({
      where: { userId },
      include: { entries: { orderBy: { createdAt: 'desc' } } },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(this.toPairJournalData);
  }

  async findByPair(userId: string, pair: string): Promise<PairJournalData | null> {
    const row = await this.prisma.pairJournal.findUnique({
      where: { userId_pair: { userId, pair } },
      include: { entries: { orderBy: { createdAt: 'desc' } } },
    });
    return row ? this.toPairJournalData(row) : null;
  }

  async findForPairs(userId: string, pairs: string[]): Promise<PairJournalData[]> {
    const rows = await this.prisma.pairJournal.findMany({
      where: { userId, pair: { in: pairs } },
      include: { entries: { orderBy: { createdAt: 'desc' } } },
    });
    return rows.map(this.toPairJournalData);
  }

  private toPairJournalData(row: {
    id: string
    pair: string
    confidence: number
    summarisedKnowledge: string
    worksheet?: unknown
    updatedAt: Date
    entries: Array<{
      id: string
      cycleNum: number
      action: string
      reasoning: string
      outcome: unknown
      mathAnalysis?: unknown
      createdAt: Date
    }>
  }): PairJournalData {
    return {
      id: row.id,
      pair: row.pair,
      confidence: row.confidence,
      summarisedKnowledge: row.summarisedKnowledge ?? '',
      worksheet: (row.worksheet as PairWorksheet | null) ?? null,
      updatedAt: row.updatedAt,
      entries: row.entries.map((e) => {
        const o = e.outcome as { pnl?: number; closeReason?: string; price?: number } | null;
        const outcome: JournalEntry['outcome'] =
          o?.pnl != null && o?.closeReason != null
            ? { pnl: o.pnl, closeReason: o.closeReason }
            : o?.price != null
              ? { price: o.price }
              : null;
        return {
          id: e.id,
          cycleNum: e.cycleNum,
          action: e.action as 'ENTER' | 'EXIT' | 'OBSERVE',
          reasoning: e.reasoning,
          outcome,
          mathAnalysis: (e.mathAnalysis as EntryMathSnapshot | null) ?? null,
          createdAt: e.createdAt,
        };
      }),
    };
  }
}
