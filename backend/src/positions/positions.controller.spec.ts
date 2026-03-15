import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as request from 'supertest';
import { PositionsController } from './positions.controller';
import { PositionsService } from './positions.service';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

const mockService = () => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  activate: jest.fn(),
  switchMode: jest.fn(),
  stop: jest.fn(),
  delete: jest.fn(),
});

const basePosition = {
  id: 'pos-1',
  pair: 'BTC/USDT',
  direction: 'LONG',
  riskAppetite: 'LOW',
  amount: 100,
  status: 'INACTIVE',
  mode: 'PAPER',
  confidence: 0,
  pnl: 0,
  entryPrice: null,
  currentPrice: null,
  createdAt: new Date().toISOString(),
  activatedAt: null,
  closedAt: null,
  trades: [],
};

describe('PositionsController', () => {
  let app: INestApplication;
  let service: ReturnType<typeof mockService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PositionsController],
      providers: [{ provide: PositionsService, useFactory: mockService }],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    service = module.get(PositionsService);
  });

  afterEach(() => app.close());

  describe('GET /positions', () => {
    it('returns 200 with a list of positions', async () => {
      service.findAll.mockResolvedValue([basePosition]);
      const res = await request(app.getHttpServer()).get('/positions');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].pair).toBe('BTC/USDT');
    });

    it('returns 200 with an empty array when there are no positions', async () => {
      service.findAll.mockResolvedValue([]);
      const res = await request(app.getHttpServer()).get('/positions');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /positions/:id', () => {
    it('returns 200 with the position', async () => {
      service.findById.mockResolvedValue(basePosition);
      const res = await request(app.getHttpServer()).get('/positions/pos-1');
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('pos-1');
    });

    it('returns 404 when position does not exist', async () => {
      service.findById.mockRejectedValue(new NotFoundException('Position missing not found'));
      const res = await request(app.getHttpServer()).get('/positions/missing');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /positions', () => {
    const validBody = { pair: 'BTC/USDT', direction: 'LONG', riskAppetite: 'LOW', amount: 100 };

    it('returns 201 with the created position', async () => {
      service.create.mockResolvedValue(basePosition);
      const res = await request(app.getHttpServer()).post('/positions').send(validBody);
      expect(res.status).toBe(201);
      expect(res.body.pair).toBe('BTC/USDT');
    });

    it('returns 409 when the pair already has an active position', async () => {
      service.create.mockRejectedValue(new ConflictException('BTC/USDT is already an active position'));
      const res = await request(app.getHttpServer()).post('/positions').send(validBody);
      expect(res.status).toBe(409);
    });

    it('returns 400 when required field is missing', async () => {
      const res = await request(app.getHttpServer()).post('/positions').send({ direction: 'LONG' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when direction is not a valid enum', async () => {
      const res = await request(app.getHttpServer())
        .post('/positions')
        .send({ pair: 'BTC/USDT', direction: 'SIDEWAYS', riskAppetite: 'LOW', amount: 100 });
      expect(res.status).toBe(400);
    });

    it('returns 400 when riskAppetite is not a valid enum', async () => {
      const res = await request(app.getHttpServer())
        .post('/positions')
        .send({ pair: 'BTC/USDT', direction: 'LONG', riskAppetite: 'EXTREME', amount: 100 });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /positions/:id/activate', () => {
    it('returns 200 with the activated position', async () => {
      service.activate.mockResolvedValue({ ...basePosition, status: 'ACTIVE' });
      const res = await request(app.getHttpServer()).post('/positions/pos-1/activate');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ACTIVE');
    });

    it('returns 400 when position is already active', async () => {
      service.activate.mockRejectedValue(new BadRequestException('Position is already active'));
      const res = await request(app.getHttpServer()).post('/positions/pos-1/activate');
      expect(res.status).toBe(400);
    });

    it('returns 404 when position does not exist', async () => {
      service.activate.mockRejectedValue(new NotFoundException('Position missing not found'));
      const res = await request(app.getHttpServer()).post('/positions/missing/activate');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /positions/:id/stop', () => {
    it('returns 200 with the stopped position', async () => {
      service.stop.mockResolvedValue({ ...basePosition, status: 'STOPPED' });
      const res = await request(app.getHttpServer()).post('/positions/pos-1/stop');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('STOPPED');
    });

    it('returns 400 when position is not active', async () => {
      service.stop.mockRejectedValue(new BadRequestException('Only active positions can be stopped'));
      const res = await request(app.getHttpServer()).post('/positions/pos-1/stop');
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /positions/:id', () => {
    it('returns 204 on successful delete', async () => {
      service.delete.mockResolvedValue(undefined);
      const res = await request(app.getHttpServer()).delete('/positions/pos-1');
      expect(res.status).toBe(204);
    });

    it('returns 404 when position does not exist', async () => {
      service.delete.mockRejectedValue(new NotFoundException('Position missing not found'));
      const res = await request(app.getHttpServer()).delete('/positions/missing');
      expect(res.status).toBe(404);
    });
  });
});
