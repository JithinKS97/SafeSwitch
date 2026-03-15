import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { SuggestionsController } from './suggestions.controller';
import { SuggestionsService } from './suggestions.service';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import type { Suggestion } from './suggestions.types';

const mockSuggestions: Suggestion[] = [
  { pair: 'BTC/USDT', direction: 'LONG', duration: '3–7 days', reason: 'Strong support', riskLevel: 'LOW' },
];

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
    it('returns 200 with suggestions for LOW risk', async () => {
      service.getSuggestions.mockReturnValue(mockSuggestions);
      const res = await request(app.getHttpServer())
        .post('/suggestions')
        .send({ riskAppetite: 'LOW' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].pair).toBe('BTC/USDT');
    });

    it('returns 200 with suggestions for MEDIUM risk', async () => {
      service.getSuggestions.mockReturnValue(mockSuggestions);
      const res = await request(app.getHttpServer())
        .post('/suggestions')
        .send({ riskAppetite: 'MEDIUM' });
      expect(res.status).toBe(200);
      expect(service.getSuggestions).toHaveBeenCalledWith('MEDIUM');
    });

    it('returns 200 with suggestions for HIGH risk', async () => {
      service.getSuggestions.mockReturnValue(mockSuggestions);
      const res = await request(app.getHttpServer())
        .post('/suggestions')
        .send({ riskAppetite: 'HIGH' });
      expect(res.status).toBe(200);
      expect(service.getSuggestions).toHaveBeenCalledWith('HIGH');
    });

    it('returns 400 when riskAppetite is missing', async () => {
      const res = await request(app.getHttpServer()).post('/suggestions').send({});
      expect(res.status).toBe(400);
    });

    it('returns 400 when riskAppetite is not a valid enum value', async () => {
      const res = await request(app.getHttpServer())
        .post('/suggestions')
        .send({ riskAppetite: 'EXTREME' });
      expect(res.status).toBe(400);
    });
  });
});
