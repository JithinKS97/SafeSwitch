import { Test } from '@nestjs/testing';
import { SuggestionsService } from './suggestions.service';
import { MarketDataService } from '../market-data/market-data.service';
import { AiService } from '../ai/ai.service';
import { SuggestionsRepository } from './suggestions.repository';
import type { CoinSnapshot } from '../market-data/market-data.types';

const UID = 'user_test123';

const mockCoins: CoinSnapshot[] = [
  { symbol: 'BTC', pair: 'BTC/USDT', price: 65000, change24h: 1.5, volume24h: 30e9, marketCap: 1.2e12 },
  { symbol: 'ETH', pair: 'ETH/USDT', price: 3500, change24h: -0.8, volume24h: 15e9, marketCap: 4e11 },
  { symbol: 'SOL', pair: 'SOL/USDT', price: 150, change24h: 4.2, volume24h: 5e9, marketCap: 6e10 },
];

const validAiResponse = JSON.stringify({
  analysis: 'Market is showing mixed signals. BTC holds steady with low volatility suitable for conservative risk.',
  suggestions: [
    { pair: 'BTC/USDT', direction: 'LONG', duration: '3-7 days', reason: 'Strong support.', riskLevel: 'LOW' },
    { pair: 'ETH/USDT', direction: 'LONG', duration: '2-5 days', reason: 'Volume stable.', riskLevel: 'LOW' },
    { pair: 'SOL/USDT', direction: 'LONG', duration: '1-3 days', reason: 'Breakout forming.', riskLevel: 'LOW' },
  ],
});

const mockSavedSnapshot = {
  id: 'snap-1',
  userId: UID,
  riskPct: 20,
  analysis: 'Market is showing mixed signals.',
  suggestions: [],
  createdAt: new Date('2026-01-01'),
};

describe('SuggestionsService', () => {
  let service: SuggestionsService;
  let marketData: { getTopCoins: jest.Mock };
  let ai: { complete: jest.Mock };
  let repo: { save: jest.Mock; findAll: jest.Mock; findById: jest.Mock };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SuggestionsService,
        { provide: MarketDataService, useValue: { getTopCoins: jest.fn() } },
        { provide: AiService, useValue: { complete: jest.fn() } },
        { provide: SuggestionsRepository, useValue: { save: jest.fn(), findAll: jest.fn(), findById: jest.fn() } },
      ],
    }).compile();

    service = module.get(SuggestionsService);
    marketData = module.get(MarketDataService);
    ai = module.get(AiService);
    repo = module.get(SuggestionsRepository);
    repo.save.mockResolvedValue(mockSavedSnapshot);
  });

  describe('happy path', () => {
    it('returns analysis and parsed suggestions', async () => {
      marketData.getTopCoins.mockResolvedValue(mockCoins);
      ai.complete.mockResolvedValue(validAiResponse);

      const result = await service.getSuggestions(20, UID);

      expect(result.analysis).toBeTruthy();
      expect(result.suggestions).toHaveLength(3);
      expect(result.suggestions[0].pair).toBe('BTC/USDT');
    });

    it('forces riskLevel to match the derived risk appetite', async () => {
      marketData.getTopCoins.mockResolvedValue(mockCoins);
      ai.complete.mockResolvedValue(validAiResponse);

      const result = await service.getSuggestions(80, UID); // HIGH
      result.suggestions.forEach((s) => expect(s.riskLevel).toBe('HIGH'));
    });

    it('strips markdown fences before parsing', async () => {
      const withFences = '```json\n' + validAiResponse + '\n```';
      marketData.getTopCoins.mockResolvedValue(mockCoins);
      ai.complete.mockResolvedValue(withFences);

      const result = await service.getSuggestions(20, UID);
      expect(result.suggestions).toHaveLength(3);
    });

    it('includes the exact riskPct in the prompt', async () => {
      marketData.getTopCoins.mockResolvedValue(mockCoins);
      ai.complete.mockResolvedValue(validAiResponse);

      await service.getSuggestions(73, UID);

      const prompt: string = ai.complete.mock.calls[0][0];
      expect(prompt).toContain('73%');
    });

    it('derives LOW for pct < 34', async () => {
      marketData.getTopCoins.mockResolvedValue(mockCoins);
      ai.complete.mockResolvedValue(validAiResponse);

      const result = await service.getSuggestions(33, UID);
      result.suggestions.forEach((s) => expect(s.riskLevel).toBe('LOW'));
    });

    it('derives MEDIUM for pct 34–66', async () => {
      const mediumResponse = JSON.stringify({
        analysis: 'Moderate market conditions.',
        suggestions: [
          { pair: 'BTC/USDT', direction: 'LONG', duration: '1d', reason: 'ok', riskLevel: 'MEDIUM' },
          { pair: 'ETH/USDT', direction: 'SHORT', duration: '2d', reason: 'ok', riskLevel: 'MEDIUM' },
          { pair: 'SOL/USDT', direction: 'LONG', duration: '3d', reason: 'ok', riskLevel: 'MEDIUM' },
        ],
      });
      marketData.getTopCoins.mockResolvedValue(mockCoins);
      ai.complete.mockResolvedValue(mediumResponse);

      const result = await service.getSuggestions(50, UID);
      result.suggestions.forEach((s) => expect(s.riskLevel).toBe('MEDIUM'));
    });
  });

  describe('fallback behaviour', () => {
    it('returns fallback when market data fetch fails', async () => {
      marketData.getTopCoins.mockRejectedValue(new Error('CoinGecko timeout'));

      const result = await service.getSuggestions(20, UID);
      expect(result.suggestions).toHaveLength(3);
      expect(result.analysis).toContain('fallback');
    });

    it('returns fallback when AI service throws', async () => {
      marketData.getTopCoins.mockResolvedValue(mockCoins);
      ai.complete.mockRejectedValue(new Error('OPENROUTER_API_KEY is not configured'));

      const result = await service.getSuggestions(50, UID);
      expect(result.suggestions).toHaveLength(3);
      expect(result.suggestions[0].riskLevel).toBe('MEDIUM');
    });

    it('returns fallback when AI response has no JSON object', async () => {
      marketData.getTopCoins.mockResolvedValue(mockCoins);
      ai.complete.mockResolvedValue('Sorry, I cannot help with that.');

      const result = await service.getSuggestions(80, UID);
      expect(result.suggestions).toHaveLength(3);
      expect(result.suggestions[0].riskLevel).toBe('HIGH');
    });

    it('returns fallback when analysis field is missing', async () => {
      const noAnalysis = JSON.stringify({ suggestions: [] });
      marketData.getTopCoins.mockResolvedValue(mockCoins);
      ai.complete.mockResolvedValue(noAnalysis);

      const result = await service.getSuggestions(20, UID);
      expect(result.analysis).toContain('fallback');
    });
  });
});
