import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PositionStatus, TradingMode, CloseReason } from '../common/types/enums';
import { PositionsRepository } from './positions.repository';
import { BinanceService } from '../binance/binance.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { ExecutionService } from '../execution/execution.service';
import { CreatePositionDto } from './dto/create-position.dto';

@Injectable()
export class PositionsService {
  constructor(
    private readonly repo: PositionsRepository,
    private readonly binance: BinanceService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ExecutionService))
    private readonly execution: ExecutionService,
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
    // Use ExecutionService so amount/pnl are updated (PAPER) or real order is placed (LIVE)
    const entryPrice = position.entryPrice ?? 0;
    let currentPrice = position.currentPrice ?? 0;
    try {
      currentPrice = await this.binance.getCurrentPrice(position.pair);
    } catch {
      // keep 0 or existing if fetch fails
    }
    const pnl =
      entryPrice && currentPrice
        ? position.direction === 'LONG'
          ? ((currentPrice - entryPrice) / entryPrice) * 100
          : ((entryPrice - currentPrice) / entryPrice) * 100
        : 0;
    const mode = (position as { mode?: 'PAPER' | 'LIVE' }).mode ?? 'PAPER';
    await this.execution.exit(id, CloseReason.MANUAL, pnl, currentPrice, mode);
    const updated = await this.repo.findById(id, userId);
    return updated!;
  }

  // Pause: works from Watching (INACTIVE) or Open (ACTIVE) — tells agent to ignore this pair.
  // When ACTIVE, close the position and update amount/pnl (same as stop).
  async pause(id: string, userId: string) {
    const position = await this.findById(id, userId);
    if (position.status === PositionStatus.STOPPED || position.status === PositionStatus.COMPLETED) {
      throw new BadRequestException('Position is already paused or closed');
    }
    if (position.status === PositionStatus.ACTIVE) {
      // Close the open position and update amount
      const entryPrice = position.entryPrice ?? 0;
      let currentPrice = position.currentPrice ?? 0;
      try {
        currentPrice = await this.binance.getCurrentPrice(position.pair);
      } catch {
        // keep 0 or existing if fetch fails
      }
      const pnl =
        entryPrice && currentPrice
          ? position.direction === 'LONG'
            ? ((currentPrice - entryPrice) / entryPrice) * 100
            : ((entryPrice - currentPrice) / entryPrice) * 100
          : 0;
      const mode = (position as { mode?: 'PAPER' | 'LIVE' }).mode ?? 'PAPER';
      await this.execution.exit(id, CloseReason.MANUAL, pnl, currentPrice, mode);
      const updated = await this.repo.findById(id, userId);
      return updated!;
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

  async resetPnl(id: string, userId: string) {
    await this.findById(id, userId); // ownership check
    return this.repo.resetPnl(id);
  }

  async updateAmount(id: string, amount: number, userId: string) {
    await this.findById(id, userId); // ownership check
    return this.repo.updateAmount(id, amount);
  }

  async updateInstruction(id: string, instruction: string, userId: string) {
    await this.findById(id, userId); // ownership check
    return this.repo.updateInstruction(id, instruction.trim());
  }

  async delete(id: string, userId: string, wipeHistory = false) {
    const position = await this.findById(id, userId);
    await this.repo.delete(id);
    if (wipeHistory) {
      await this.prisma.pairJournal.deleteMany({ where: { userId, pair: position.pair } });
    }
  }
}
