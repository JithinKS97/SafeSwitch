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

  /** Load position by id only (for execution; no userId filter). */
  findByIdForExecution(id: string) {
    return this.prisma.position.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        pair: true,
        direction: true,
        amount: true,
        entryPrice: true,
        liveQuantity: true,
      },
    });
  }

  findActiveByPair(pair: string, userId: string) {
    // STOPPED = paused by user — still "belongs" to them, block re-adding
    return this.prisma.position.findFirst({
      where: { pair, userId, status: { in: ['INACTIVE', 'ACTIVE', 'STOPPED'] } },
    });
  }

  findAllInactive(userId: string) {
    return this.prisma.position.findMany({
      where: { userId, status: 'INACTIVE' },
      orderBy: { createdAt: 'asc' },
    });
  }

  findAllActive(userId: string) {
    return this.prisma.position.findMany({
      where: { userId, status: 'ACTIVE' },
      orderBy: { activatedAt: 'asc' },
    });
  }

  // Users who have at least one pair the agent should manage (Watching or Open)
  findAllManagedAcrossUsers() {
    return this.prisma.position.findMany({
      where: { status: { in: ['INACTIVE', 'ACTIVE'] } },
      select: { userId: true },
      distinct: ['userId'],
    });
  }

  activateByAgent(id: string, entryPrice: number) {
    return this.prisma.position.update({
      where: { id },
      data: { status: 'ACTIVE', entryPrice, activatedAt: new Date(), agentOpened: true },
    });
  }

  activateByAgentWithLive(id: string, entryPrice: number, liveQuantity: number) {
    return this.prisma.position.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        entryPrice,
        liveQuantity,
        activatedAt: new Date(),
        agentOpened: true,
      },
    });
  }

  findClosed(userId: string, limit = 10) {
    return this.prisma.position.findMany({
      where: { userId, status: { in: ['COMPLETED', 'STOPPED'] } },
      orderBy: { closedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        pair: true,
        direction: true,
        pnl: true,
        closeReason: true,
        entryPrice: true,
        currentPrice: true,
        closedAt: true,
      },
    });
  }

  create(dto: CreatePositionDto, userId: string) {
    return this.prisma.position.create({
      data: {
        userId,
        pair: dto.pair,
        direction: dto.direction,
        riskAppetite: dto.riskAppetite,
        amount: dto.amount,
      },
    });
  }

  openByAgent(
    pair: string,
    direction: 'LONG' | 'SHORT',
    riskAppetite: 'LOW' | 'MEDIUM' | 'HIGH',
    entryPrice: number,
    userId: string,
  ) {
    return this.prisma.position.create({
      data: {
        userId,
        pair,
        direction,
        riskAppetite,
        entryPrice,
        status: 'ACTIVE',
        activatedAt: new Date(),
        agentOpened: true,
      },
    });
  }

  async closeByAgent(id: string, reason: CloseReason, pnl: number, currentPrice: number) {
    const pos = await this.prisma.position.findUnique({
      where: { id },
      select: { amount: true },
    });
    const currentAmount = pos?.amount ?? 0;
    const newAmount = Math.max(0, currentAmount * (1 + pnl / 100));

    return this.prisma.position.update({
      where: { id },
      data: {
        status: reason === CloseReason.PROFIT_TARGET ? 'COMPLETED' : 'STOPPED',
        closeReason: reason,
        pnl,
        currentPrice,
        closedAt: new Date(),
        amount: newAmount,
      },
    });
  }

  /** Create a new INACTIVE (watching) position from a closed position so the agent can re-enter. */
  createWatchingFromClosed(params: {
    userId: string;
    pair: string;
    direction: 'LONG' | 'SHORT';
    riskAppetite: string;
    amount: number;
    instruction?: string;
    mode?: 'PAPER' | 'LIVE';
  }) {
    return this.prisma.position.create({
      data: {
        userId: params.userId,
        pair: params.pair,
        direction: params.direction,
        riskAppetite: params.riskAppetite as 'LOW' | 'MEDIUM' | 'HIGH',
        amount: Math.max(0, params.amount),
        instruction: params.instruction ?? '',
        mode: params.mode ?? 'PAPER',
      },
    });
  }

  activate(id: string) {
    return this.prisma.position.update({
      where: { id },
      data: { status: PositionStatus.ACTIVE, activatedAt: new Date() },
    });
  }

  // Pause: user tells agent to stop managing this pair
  pause(id: string) {
    return this.prisma.position.update({
      where: { id },
      data: { status: PositionStatus.STOPPED },
    });
  }

  // Resume: user puts pair back into "Watching" so agent manages it again
  resume(id: string) {
    return this.prisma.position.update({
      where: { id },
      data: { status: PositionStatus.INACTIVE, closeReason: null, closedAt: null, pnl: 0 },
    });
  }

  /** @deprecated use resume() */
  reopen(id: string) {
    return this.resume(id);
  }

  switchMode(id: string, mode: TradingMode) {
    return this.prisma.position.update({ where: { id }, data: { mode } });
  }

  updateInstruction(id: string, instruction: string) {
    return this.prisma.position.update({
      where: { id },
      data: { instruction },
    });
  }

  delete(id: string) {
    return this.prisma.position.delete({ where: { id } });
  }

  updateConfidence(id: string, confidence: number, pnl: number) {
    return this.prisma.position.update({ where: { id }, data: { confidence, pnl } });
  }
}
