import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { SuggestionsController } from './suggestions.controller';
import { SuggestionsService } from './suggestions.service';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import type { SuggestionsResponse } from './suggestions.types';

const mockResponse: SuggestionsResponse = {
  analysis: 'BTC shows strong support. Low volatility environment favours conservative longs.',
  suggestions: [
    { pair: 'BTC/USDT', direction: 'LONG', duration: '3–7 days', reason: 'Strong support', riskLevel: 'LOW' },
  ],
};

describe('SuggestionsController', () => {
  let app: INestApplication;
  let service: { getSuggestions: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SuggestionsController],
      providers: [
        { provide: SuggestionsService, useValue: { getSuggestions: jest.fn() } },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    service = module.get(SuggestionsService);
  });

  afterEach(() => app.close());

  describe('POST /suggestions', () => {
    it('returns 200 with analysis and suggestions', async () => {
      service.getSuggestions.mockResolvedValue(mockResponse);
      const res = await request(app.getHttpServer())
        .post('/suggestions')
        .send({ riskPct: 5 });
      expect(res.status).toBe(200);
      expect(res.body.analysis).toBeTruthy();
      expect(res.body.suggestions[0].pair).toBe('BTC/USDT');
    });

    it('passes the riskPct number to the service', async () => {
      service.getSuggestions.mockResolvedValue(mockResponse);
      await request(app.getHttpServer()).post('/suggestions').send({ riskPct: 7 });
      expect(service.getSuggestions).toHaveBeenCalledWith(7, undefined);
    });

    it('returns 400 when riskPct is missing', async () => {
      const res = await request(app.getHttpServer()).post('/suggestions').send({});
      expect(res.status).toBe(400);
    });

    it('returns 400 when riskPct is below 0', async () => {
      const res = await request(app.getHttpServer())
        .post('/suggestions')
        .send({ riskPct: -1 });
      expect(res.status).toBe(400);
    });

    it('returns 400 when riskPct is above 10', async () => {
      const res = await request(app.getHttpServer())
        .post('/suggestions')
        .send({ riskPct: 11 });
      expect(res.status).toBe(400);
    });

    it('returns 400 when riskPct is not an integer', async () => {
      const res = await request(app.getHttpServer())
        .post('/suggestions')
        .send({ riskPct: 5.5 });
      expect(res.status).toBe(400);
    });
  });
});
