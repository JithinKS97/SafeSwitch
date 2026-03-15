import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PositionStatus, TradingMode, CloseReason } from '../common/types/enums';
import { PositionsRepository } from './positions.repository';
import { BinanceService } from '../binance/binance.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreatePositionDto } from './dto/create-position.dto';

@Injectable()
export class PositionsService {
  constructor(
    private readonly repo: PositionsRepository,
    private readonly binance: BinanceService,
    private readonly prisma: PrismaService,
  ) {}

  async findAll(userId: string) {
    const positions = await this.repo.findAll(userId);
    const active = positions.filter((p) => p.status === PositionStatus.ACTIVE);
    if (active.length === 0) return positions;

    const priceMap: Record<string, number> = {};
    await Promise.all(
      active.map(async (p) => {
        try {
          priceMap[p.pair] = await this.binance.getCurrentPrice(p.pair);
        } catch {
          // keep existing currentPrice if fetch fails
        }
      }),
    );

    return positions.map((p) => {
      if (p.status !== PositionStatus.ACTIVE) return p;
      const currentPrice = priceMap[p.pair] ?? p.currentPrice ?? p.entryPrice ?? 0;
      const entryPrice = p.entryPrice ?? currentPrice;
      const pnl =
        entryPrice && currentPrice
          ? p.direction === 'LONG'
            ? ((currentPrice - entryPrice) / entryPrice) * 100
            : ((entryPrice - currentPrice) / entryPrice) * 100
          : 0;
      return { ...p, currentPrice, pnl };
    });
  }

  async findById(id: string, userId: string) {
    const position = await this.repo.findById(id, userId);
    if (!position) throw new NotFoundException(`Position ${id} not found`);
    return position;
  }

  async create(dto: CreatePositionDto, userId: string) {
    const existing = await this.repo.findActiveByPair(dto.pair, userId);
    if (existing) {
      throw new ConflictException(`${dto.pair} is already an active position`);
    }
    return this.repo.create(dto, userId);
  }

  async activate(id: string, userId: string) {
    const position = await this.findById(id, userId);
    if (position.status !== PositionStatus.INACTIVE) {
      throw new BadRequestException(`Position is already ${position.status.toLowerCase()}`);
    }
    return this.repo.activate(id);
  }

  async switchMode(id: string, mode: TradingMode, userId: string) {
    const position = await this.findById(id, userId);
    if (position.status !== PositionStatus.INACTIVE && position.status !== PositionStatus.ACTIVE) {
      throw new BadRequestException('Can only switch mode for watching or open positions');
    }
    if (position.mode === mode) {
      throw new BadRequestException(`Position is already in ${mode} mode`);
    }
    return this.repo.switchMode(id, mode);
  }

  async stop(id: string, userId: string) {
    const position = await this.findById(id, userId);
    if (position.status !== PositionStatus.ACTIVE) {
      throw new BadRequestException('Only active positions can be stopped');
    }
    return this.repo.stop(id, CloseReason.MANUAL);
  }

  // Pause: works from Watching (INACTIVE) or Open (ACTIVE) — tells agent to ignore this pair
  async pause(id: string, userId: string) {
    const position = await this.findById(id, userId);
    if (position.status === PositionStatus.STOPPED || position.status === PositionStatus.COMPLETED) {
      throw new BadRequestException('Position is already paused or closed');
    }
    return this.repo.pause(id);
  }

  // Resume: puts a Paused or Closed pair back into Watching so the agent manages it again
  async resume(id: string, userId: string) {
    const position = await this.findById(id, userId);
    if (position.status === PositionStatus.INACTIVE || position.status === PositionStatus.ACTIVE) {
      throw new BadRequestException('Position is already being managed');
    }
    return this.repo.resume(id);
  }

  /** @deprecated use resume() */
  async reopen(id: string, userId: string) {
    return this.resume(id, userId);
  }

  async updateInstruction(id: string, instruction: string, userId: string) {
    const position = await this.findById(id, userId);
    return this.repo.updateInstruction(id, instruction.trim());
  }

  async delete(id: string, userId: string) {
    const position = await this.findById(id, userId);
    await this.repo.delete(id);
    await this.prisma.pairJournal.deleteMany({
      where: { userId, pair: position.pair },
    });
  }
}
