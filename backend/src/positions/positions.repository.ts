import { Injectable } from '@nestjs/common';
import { PositionStatus, TradingMode, CloseReason } from '../common/types/enums';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreatePositionDto } from './dto/create-position.dto';

@Injectable()
export class PositionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.position.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { trades: { orderBy: { openedAt: 'desc' }, take: 5 } },
    });
  }

  findById(id: string, userId: string) {
    return this.prisma.position.findFirst({
      where: { id, userId },
      include: { trades: { orderBy: { openedAt: 'desc' } } },
    });
  }

  findActiveByPair(pair: string, userId: string) {
    return this.prisma.position.findFirst({
      where: { pair, userId, status: { in: ['INACTIVE', 'ACTIVE'] } },
    });
  }

  create(dto: CreatePositionDto, userId: string) {
    return this.prisma.position.create({
      data: {
        userId,
        pair: dto.pair,
        direction: dto.direction,
        riskAppetite: dto.riskAppetite,
      },
    });
  }

  activate(id: string) {
    return this.prisma.position.update({
      where: { id },
      data: { status: PositionStatus.ACTIVE, activatedAt: new Date() },
    });
  }

  switchMode(id: string, mode: TradingMode) {
    return this.prisma.position.update({ where: { id }, data: { mode } });
  }

  stop(id: string, reason: CloseReason) {
    return this.prisma.position.update({
      where: { id },
      data: { status: PositionStatus.STOPPED, closeReason: reason, closedAt: new Date() },
    });
  }

  delete(id: string) {
    return this.prisma.position.delete({ where: { id } });
  }

  updateConfidence(id: string, confidence: number, pnl: number) {
    return this.prisma.position.update({ where: { id }, data: { confidence, pnl } });
  }
}
