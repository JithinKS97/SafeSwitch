import { Injectable, Logger } from '@nestjs/common';
import { RiskAppetite } from '../common/types/enums';
import { MarketDataService } from '../market-data/market-data.service';
import { AiService } from '../ai/ai.service';
import { SuggestionsRepository } from './suggestions.repository';
import type { Suggestion, SuggestionsResponse, SnapshotSummary } from './suggestions.types';
import type { CoinSnapshot } from '../market-data/market-data.types';

const FALLBACK: Record<RiskAppetite, SuggestionsResponse> = {
  LOW: {
    analysis: 'Using fallback suggestions. AI or market data service is currently unavailable.',
    suggestions: [
      { pair: 'BTC/USDT', direction: 'LONG', duration: '3–7 days', reason: 'Strong support at current level, low volatility, steady uptrend.', riskLevel: 'LOW' },
      { pair: 'ETH/USDT', direction: 'LONG', duration: '2–5 days', reason: 'Consolidating above key MA, volume stable, low drawdown risk.', riskLevel: 'LOW' },
      { pair: 'BNB/USDT', direction: 'LONG', duration: '3–6 days', reason: 'Slow grind upward, RSI neutral, tight range with clear support.', riskLevel: 'LOW' },
    ],
  },
  MEDIUM: {
    analysis: 'Using fallback suggestions. AI or market data service is currently unavailable.',
    suggestions: [
      { pair: 'SOL/USDT', direction: 'LONG', duration: '1–3 days', reason: 'RSI recovering from oversold, volume spike, breakout pattern forming.', riskLevel: 'MEDIUM' },
      { pair: 'AVAX/USDT', direction: 'SHORT', duration: '4–8 hours', reason: 'Rejected resistance twice, momentum fading, local top likely.', riskLevel: 'MEDIUM' },
      { pair: 'MATIC/USDT', direction: 'LONG', duration: '1–2 days', reason: 'Higher lows forming, volume increasing, approaching breakout zone.', riskLevel: 'MEDIUM' },
    ],
  },
  HIGH: {
    analysis: 'Using fallback suggestions. AI or market data service is currently unavailable.',
    suggestions: [
      { pair: 'PEPE/USDT', direction: 'LONG', duration: '1–4 hours', reason: 'Massive volume spike, meme season momentum, high risk/reward.', riskLevel: 'HIGH' },
      { pair: 'WIF/USDT', direction: 'SHORT', duration: '2–6 hours', reason: 'Parabolic run losing steam, RSI overbought, sharp correction likely.', riskLevel: 'HIGH' },
      { pair: 'DOGE/USDT', direction: 'LONG', duration: '4–12 hours', reason: 'Social media surge detected, high volatility window opening.', riskLevel: 'HIGH' },
    ],
  },
};

function pctToRiskAppetite(pct: number): RiskAppetite {
  if (pct < 34) return 'LOW';
  if (pct < 67) return 'MEDIUM';
  return 'HIGH';
}

@Injectable()
export class SuggestionsService {
  private readonly logger = new Logger(SuggestionsService.name);

  constructor(
    private readonly marketData: MarketDataService,
    private readonly ai: AiService,
    private readonly repo: SuggestionsRepository,
  ) {}

  async getSuggestions(riskPct: number, userId: string): Promise<SuggestionsResponse> {
    const riskAppetite = pctToRiskAppetite(riskPct);
    try {
      const coins = await this.marketData.getTopCoins();
      const prompt = this.buildPrompt(riskPct, riskAppetite, coins);
      const response = await this.ai.complete(prompt);
      const result = this.parseResponse(response, riskAppetite);
      const saved = await this.repo.save(userId, riskPct, result.analysis, result.suggestions);
      return { ...result, id: saved.id, createdAt: saved.createdAt.toISOString() };
    } catch (err) {
      this.logger.warn(
        `AI suggestions failed, using fallback: ${(err as Error).message}`,
      );
      return FALLBACK[riskAppetite];
    }
  }

  async getHistory(userId: string): Promise<SnapshotSummary[]> {
    const rows = await this.repo.findAll(userId);
    return rows.map((r) => ({
      id: r.id,
      riskPct: r.riskPct,
      analysis: r.analysis,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async getById(id: string, userId: string): Promise<SuggestionsResponse | null> {
    const row = await this.repo.findById(id, userId);
    if (!row) return null;
    return {
      id: row.id,
      riskPct: row.riskPct,
      analysis: row.analysis,
      suggestions: row.suggestions as Suggestion[],
      createdAt: row.createdAt.toISOString(),
    };
  }

  private buildPrompt(
    riskPct: number,
    riskAppetite: RiskAppetite,
    coins: CoinSnapshot[],
  ): string {
    const riskDescriptions: Record<RiskAppetite, string> = {
      LOW: 'conservative — prefer large caps (BTC, ETH), multi-day holds, minimal drawdown risk',
      MEDIUM: 'moderate — swing trades on mid/large caps, hold for hours to a few days',
      HIGH: 'aggressive — small caps and meme coins acceptable, short-term trades, high volatility ok',
    };

    const marketLines = coins
      .map(
        (c) =>
          `${c.pair} | price: $${c.price.toLocaleString()} | 24h: ${c.change24h >= 0 ? '+' : ''}${c.change24h.toFixed(2)}% | vol: $${(c.volume24h / 1e6).toFixed(0)}M`,
      )
      .join('\n');

    return `You are a crypto trading advisor. Analyse the market data below and suggest exactly 3 trading pairs.

Risk appetite: ${riskPct}% (${riskAppetite} — ${riskDescriptions[riskAppetite]})

Current market data (top 30 by market cap):
${marketLines}

Instructions:
1. Write a short analysis (3-5 sentences) explaining what you observe in the market data and how the risk appetite of ${riskPct}% shapes your picks.
2. Then select exactly 3 pairs that best fit this risk level.
3. For each pair, direction must be "LONG" or "SHORT", riskLevel must be "${riskAppetite}".

Respond ONLY with valid JSON in this exact shape, no markdown fences, no extra text:
{
  "analysis": "Your market observations and reasoning here...",
  "suggestions": [
    {"pair":"BTC/USDT","direction":"LONG","duration":"3-7 days","reason":"...","riskLevel":"${riskAppetite}"}
  ]
}`;
  }

  private parseResponse(
    raw: string,
    riskAppetite: RiskAppetite,
  ): SuggestionsResponse {
    const cleaned = raw
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) {
      throw new Error('No JSON object found in AI response');
    }

    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
      analysis?: unknown;
      suggestions?: unknown;
    };

    if (typeof parsed.analysis !== 'string' || parsed.analysis.trim() === '') {
      throw new Error('Missing or empty analysis in AI response');
    }

    if (!Array.isArray(parsed.suggestions) || parsed.suggestions.length === 0) {
      throw new Error('Missing or empty suggestions array in AI response');
    }

    const suggestions: Suggestion[] = parsed.suggestions.map(
      (item: unknown, idx: number) => {
        const s = item as Record<string, unknown>;
        if (
          typeof s.pair !== 'string' ||
          (s.direction !== 'LONG' && s.direction !== 'SHORT') ||
          typeof s.duration !== 'string' ||
          typeof s.reason !== 'string'
        ) {
          throw new Error(`Invalid suggestion shape at index ${idx}`);
        }
        return {
          pair: s.pair,
          direction: s.direction,
          duration: s.duration,
          reason: s.reason,
          riskLevel: riskAppetite,
        } satisfies Suggestion;
      },
    );

    return { analysis: parsed.analysis.trim(), suggestions };
  }
}
