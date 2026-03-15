import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export type JournalDecisions = {
  opened: { pair: string; direction: string }[];
  closed: { pair: string; reason: string; pnl: number }[];
};

@Injectable()
export class AgentJournalRepository {
  constructor(private readonly prisma: PrismaService) {}

  async nextCycleNum(userId: string): Promise<number> {
    const latest = await this.prisma.agentJournal.findFirst({
      where: { userId },
      orderBy: { cycleNum: 'desc' },
      select: { cycleNum: true },
    });
    return (latest?.cycleNum ?? 0) + 1;
  }

  save(userId: string, cycleNum: number, entry: string, decisions: JournalDecisions) {
    return this.prisma.agentJournal.create({
      data: { userId, cycleNum, entry, decisions },
    });
  }

  findRecent(userId: string, limit = 5) {
    return this.prisma.agentJournal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  findAll(userId: string) {
    return this.prisma.agentJournal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  deleteOne(id: string, userId: string) {
    return this.prisma.agentJournal.deleteMany({ where: { id, userId } });
  }

  deleteAll(userId: string) {
    return this.prisma.agentJournal.deleteMany({ where: { userId } });
  }
}
