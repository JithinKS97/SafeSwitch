import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SuggestionsService } from './suggestions.service';
import { MarketDataService } from '../market-data/market-data.service';
import { SuggestionsRepository } from './suggestions.repository';
import { SUGGESTION_ENGINE } from '../suggestion-engine/suggestion-engine.interface';
import type { CoinSnapshot } from '../market-data/market-data.types';

const UID = 'user_test123';

const mockCoins: CoinSnapshot[] = [
  { symbol: 'BTC', pair: 'BTC/USDT', price: 65000, change24h: 1.5, volume24h: 30e9, marketCap: 1.2e12 },
  { symbol: 'ETH', pair: 'ETH/USDT', price: 3500, change24h: -0.8, volume24h: 15e9, marketCap: 4e11 },
  { symbol: 'SOL', pair: 'SOL/USDT', price: 150, change24h: 4.2, volume24h: 5e9, marketCap: 6e10 },
];

const mockSavedSnapshot = {
  id: 'snap-1',
  userId: UID,
  riskPct: 5,
  analysis: 'Market is showing mixed signals.',
  suggestions: [],
  createdAt: new Date('2026-01-01'),
};

describe('SuggestionsService', () => {
  let service: SuggestionsService;
  let marketData: { getTopCoins: jest.Mock };
  let suggestionEngine: { suggest: jest.Mock };
  let repo: { save: jest.Mock; findAll: jest.Mock; findById: jest.Mock };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SuggestionsService,
        { provide: MarketDataService, useValue: { getTopCoins: jest.fn() } },
        {
          provide: SUGGESTION_ENGINE,
          useValue: { suggest: jest.fn() },
        },
        { provide: SuggestionsRepository, useValue: { save: jest.fn(), findAll: jest.fn(), findById: jest.fn() } },
      ],
    }).compile();

    service = module.get(SuggestionsService);
    marketData = module.get(MarketDataService);
    suggestionEngine = module.get(SUGGESTION_ENGINE);
    repo = module.get(SuggestionsRepository);
    repo.save.mockResolvedValue(mockSavedSnapshot);
  });

  describe('happy path', () => {
    it('returns analysis and parsed suggestions', async () => {
      marketData.getTopCoins.mockResolvedValue(mockCoins);
      suggestionEngine.suggest.mockResolvedValue({
        analysis: 'Market is showing mixed signals.',
        suggestions: [
          { pair: 'BTC/USDT', direction: 'LONG', duration: '3-7 days', reason: 'Strong support.', riskLevel: 'LOW' },
          { pair: 'ETH/USDT', direction: 'LONG', duration: '2-5 days', reason: 'Volume stable.', riskLevel: 'LOW' },
          { pair: 'SOL/USDT', direction: 'LONG', duration: '1-3 days', reason: 'Breakout forming.', riskLevel: 'LOW' },
        ],
      });

      const result = await service.getSuggestions(5, UID);

      expect(result.analysis).toBeTruthy();
      expect(result.suggestions).toHaveLength(3);
      expect(result.suggestions[0].pair).toBe('BTC/USDT');
    });

    it('forces riskLevel to match the derived risk appetite', async () => {
      marketData.getTopCoins.mockResolvedValue(mockCoins);
      suggestionEngine.suggest.mockResolvedValue({
        analysis: 'High risk picks.',
        suggestions: [
          { pair: 'PEPE/USDT', direction: 'LONG', duration: '1h', reason: 'ok', riskLevel: 'HIGH' },
          { pair: 'WIF/USDT', direction: 'SHORT', duration: '2h', reason: 'ok', riskLevel: 'HIGH' },
          { pair: 'DOGE/USDT', direction: 'LONG', duration: '4h', reason: 'ok', riskLevel: 'HIGH' },
        ],
      });

      const result = await service.getSuggestions(8, UID); // HIGH
      result.suggestions.forEach((s) => expect(s.riskLevel).toBe('HIGH'));
    });

    it('passes riskPct and marketData to engine', async () => {
      marketData.getTopCoins.mockResolvedValue(mockCoins);
      suggestionEngine.suggest.mockResolvedValue({
        analysis: 'Test.',
        suggestions: [
          { pair: 'BTC/USDT', direction: 'LONG', duration: '1d', reason: 'ok', riskLevel: 'LOW' },
          { pair: 'ETH/USDT', direction: 'LONG', duration: '1d', reason: 'ok', riskLevel: 'LOW' },
          { pair: 'SOL/USDT', direction: 'LONG', duration: '1d', reason: 'ok', riskLevel: 'LOW' },
        ],
      });

      await service.getSuggestions(7, UID);

      const input = suggestionEngine.suggest.mock.calls[0][0];
      expect(input.riskPct).toBe(7);
      expect(input.marketData).toHaveLength(3);
    });

    it('derives LOW for risk <= 3', async () => {
      marketData.getTopCoins.mockResolvedValue(mockCoins);
      suggestionEngine.suggest.mockResolvedValue({
        analysis: 'Low risk.',
        suggestions: [
          { pair: 'BTC/USDT', direction: 'LONG', duration: '1d', reason: 'ok', riskLevel: 'LOW' },
          { pair: 'ETH/USDT', direction: 'LONG', duration: '1d', reason: 'ok', riskLevel: 'LOW' },
          { pair: 'SOL/USDT', direction: 'LONG', duration: '1d', reason: 'ok', riskLevel: 'LOW' },
        ],
      });

      const result = await service.getSuggestions(3, UID);
      result.suggestions.forEach((s) => expect(s.riskLevel).toBe('LOW'));
    });

    it('derives MEDIUM for risk 4–6', async () => {
      marketData.getTopCoins.mockResolvedValue(mockCoins);
      suggestionEngine.suggest.mockResolvedValue({
        analysis: 'Moderate market conditions.',
        suggestions: [
          { pair: 'BTC/USDT', direction: 'LONG', duration: '1d', reason: 'ok', riskLevel: 'MEDIUM' },
          { pair: 'ETH/USDT', direction: 'SHORT', duration: '2d', reason: 'ok', riskLevel: 'MEDIUM' },
          { pair: 'SOL/USDT', direction: 'LONG', duration: '3d', reason: 'ok', riskLevel: 'MEDIUM' },
        ],
      });

      const result = await service.getSuggestions(5, UID);
      result.suggestions.forEach((s) => expect(s.riskLevel).toBe('MEDIUM'));
    });
  });

  describe('error handling', () => {
    it('throws BadRequestException when market data fetch fails', async () => {
      marketData.getTopCoins.mockRejectedValue(new Error('CoinGecko timeout'));

      await expect(service.getSuggestions(5, UID)).rejects.toThrow(BadRequestException);
      await expect(service.getSuggestions(5, UID)).rejects.toThrow('CoinGecko timeout');
    });

    it('throws BadRequestException when engine throws', async () => {
      marketData.getTopCoins.mockResolvedValue(mockCoins);
      suggestionEngine.suggest.mockRejectedValue(new Error('API error'));

      await expect(service.getSuggestions(5, UID)).rejects.toThrow(BadRequestException);
      await expect(service.getSuggestions(5, UID)).rejects.toThrow('API error');
    });
  });
});
