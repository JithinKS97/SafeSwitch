import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PositionStatus, TradingMode, CloseReason } from '../common/types/enums';
import { PositionsRepository } from './positions.repository';
import { CreatePositionDto } from './dto/create-position.dto';

@Injectable()
export class PositionsService {
  constructor(private readonly repo: PositionsRepository) {}

  findAll() {
    return this.repo.findAll();
  }

  async findById(id: string) {
    const position = await this.repo.findById(id);
    if (!position) throw new NotFoundException(`Position ${id} not found`);
    return position;
  }

  async create(dto: CreatePositionDto) {
    const existing = await this.repo.findActiveByPair(dto.pair);
    if (existing) {
      throw new ConflictException(`${dto.pair} is already an active position`);
    }
    return this.repo.create(dto);
  }

  async activate(id: string) {
    const position = await this.findById(id);

    if (position.status !== PositionStatus.INACTIVE) {
      throw new BadRequestException(
        `Position is already ${position.status.toLowerCase()}`,
      );
    }

    return this.repo.activate(id);
  }

  async switchMode(id: string, mode: TradingMode) {
    const position = await this.findById(id);

    if (position.status !== PositionStatus.ACTIVE) {
      throw new BadRequestException('Position must be active to switch mode');
    }

    if (position.mode === mode) {
      throw new BadRequestException(`Position is already in ${mode} mode`);
    }

    return this.repo.switchMode(id, mode);
  }

  async stop(id: string) {
    const position = await this.findById(id);

    if (position.status !== PositionStatus.ACTIVE) {
      throw new BadRequestException('Only active positions can be stopped');
    }

    return this.repo.stop(id, CloseReason.MANUAL);
  }

  async delete(id: string) {
    await this.findById(id);
    return this.repo.delete(id);
  }
}
