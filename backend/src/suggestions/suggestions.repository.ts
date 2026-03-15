import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import type { Suggestion } from './suggestions.types';

@Injectable()
export class SuggestionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  save(userId: string, riskPct: number, analysis: string, suggestions: Suggestion[]) {
    return this.prisma.suggestionSnapshot.create({
      data: { userId, riskPct, analysis, suggestions },
    });
  }

  findAll(userId: string) {
    return this.prisma.suggestionSnapshot.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, riskPct: true, analysis: true, createdAt: true },
    });
  }

  findById(id: string, userId: string) {
    return this.prisma.suggestionSnapshot.findFirst({ where: { id, userId } });
  }
}
