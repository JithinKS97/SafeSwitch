import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PositionsService } from './positions.service';
import { PositionsRepository } from './positions.repository';
import type { CreatePositionDto } from './dto/create-position.dto';

const mockRepo = () => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  findActiveByPair: jest.fn(),
  create: jest.fn(),
  activate: jest.fn(),
  switchMode: jest.fn(),
  stop: jest.fn(),
  delete: jest.fn(),
  updateConfidence: jest.fn(),
});

const basePosition = {
  id: 'pos-1',
  pair: 'BTC/USDT',
  direction: 'LONG' as const,
  riskAppetite: 'LOW' as const,
  status: 'INACTIVE' as const,
  mode: 'PAPER' as const,
  confidence: 0,
  pnl: 0,
  entryPrice: null,
  currentPrice: null,
  createdAt: new Date(),
  activatedAt: null,
  closedAt: null,
  closeReason: null,
  trades: [],
};

describe('PositionsService', () => {
  let service: PositionsService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PositionsService,
        { provide: PositionsRepository, useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(PositionsService);
    repo = module.get(PositionsRepository);
  });

  describe('findById', () => {
    it('returns the position when found', async () => {
      repo.findById.mockResolvedValue(basePosition);
      await expect(service.findById('pos-1')).resolves.toEqual(basePosition);
    });

    it('throws NotFoundException when position does not exist', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const dto: CreatePositionDto = {
      pair: 'BTC/USDT',
      direction: 'LONG',
      riskAppetite: 'LOW',
    };

    it('creates the position when no active pair exists', async () => {
      repo.findActiveByPair.mockResolvedValue(null);
      repo.create.mockResolvedValue(basePosition);
      await expect(service.create(dto)).resolves.toEqual(basePosition);
      expect(repo.create).toHaveBeenCalledWith(dto);
    });

    it('throws ConflictException when the pair already has an active position', async () => {
      repo.findActiveByPair.mockResolvedValue(basePosition);
      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('activate', () => {
    it('activates an INACTIVE position', async () => {
      repo.findById.mockResolvedValue({ ...basePosition, status: 'INACTIVE' });
      repo.activate.mockResolvedValue({ ...basePosition, status: 'ACTIVE' });
      await expect(service.activate('pos-1')).resolves.toMatchObject({ status: 'ACTIVE' });
    });

    it('throws BadRequestException when position is already ACTIVE', async () => {
      repo.findById.mockResolvedValue({ ...basePosition, status: 'ACTIVE' });
      await expect(service.activate('pos-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when position is STOPPED', async () => {
      repo.findById.mockResolvedValue({ ...basePosition, status: 'STOPPED' });
      await expect(service.activate('pos-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('switchMode', () => {
    it('switches from PAPER to LIVE', async () => {
      repo.findById.mockResolvedValue({ ...basePosition, status: 'ACTIVE', mode: 'PAPER' });
      repo.switchMode.mockResolvedValue({ ...basePosition, status: 'ACTIVE', mode: 'LIVE' });
      await expect(service.switchMode('pos-1', 'LIVE')).resolves.toMatchObject({ mode: 'LIVE' });
    });

    it('throws BadRequestException when position is not ACTIVE', async () => {
      repo.findById.mockResolvedValue({ ...basePosition, status: 'INACTIVE', mode: 'PAPER' });
      await expect(service.switchMode('pos-1', 'LIVE')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when mode is already the same', async () => {
      repo.findById.mockResolvedValue({ ...basePosition, status: 'ACTIVE', mode: 'PAPER' });
      await expect(service.switchMode('pos-1', 'PAPER')).rejects.toThrow(BadRequestException);
    });
  });

  describe('stop', () => {
    it('stops an ACTIVE position', async () => {
      repo.findById.mockResolvedValue({ ...basePosition, status: 'ACTIVE' });
      repo.stop.mockResolvedValue({ ...basePosition, status: 'STOPPED' });
      await expect(service.stop('pos-1')).resolves.toMatchObject({ status: 'STOPPED' });
    });

    it('throws BadRequestException when position is not ACTIVE', async () => {
      repo.findById.mockResolvedValue({ ...basePosition, status: 'INACTIVE' });
      await expect(service.stop('pos-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('deletes an existing position', async () => {
      repo.findById.mockResolvedValue(basePosition);
      repo.delete.mockResolvedValue(basePosition);
      await service.delete('pos-1');
      expect(repo.delete).toHaveBeenCalledWith('pos-1');
    });

    it('throws NotFoundException when position does not exist', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.delete('missing')).rejects.toThrow(NotFoundException);
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });
});
