import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import type {
  SuggestionEngine,
  SuggestionInput,
  SuggestionOutput,
  SuggestionItem,
} from './suggestion-engine.interface';

const FALLBACK: Record<string, SuggestionOutput> = {
  LOW: {
    analysis: 'Using fallback suggestions. AI or market data service is currently unavailable.',
    suggestions: [
      {
        pair: 'BTC/USDT',
        direction: 'LONG',
        duration: '3–7 days',
        reason: 'Strong support at current level, low volatility, steady uptrend.',
        riskLevel: 'LOW',
      },
      {
        pair: 'ETH/USDT',
        direction: 'LONG',
        duration: '2–5 days',
        reason: 'Consolidating above key MA, volume stable, low drawdown risk.',
        riskLevel: 'LOW',
      },
      {
        pair: 'BNB/USDT',
        direction: 'LONG',
        duration: '3–6 days',
        reason: 'Slow grind upward, RSI neutral, tight range with clear support.',
        riskLevel: 'LOW',
      },
    ],
  },
  MEDIUM: {
    analysis: 'Using fallback suggestions. AI or market data service is currently unavailable.',
    suggestions: [
      {
        pair: 'SOL/USDT',
        direction: 'LONG',
        duration: '1–3 days',
        reason: 'RSI recovering from oversold, volume spike, breakout pattern forming.',
        riskLevel: 'MEDIUM',
      },
      {
        pair: 'AVAX/USDT',
        direction: 'SHORT',
        duration: '4–8 hours',
        reason: 'Rejected resistance twice, momentum fading, local top likely.',
        riskLevel: 'MEDIUM',
      },
      {
        pair: 'MATIC/USDT',
        direction: 'LONG',
        duration: '1–2 days',
        reason: 'Higher lows forming, volume increasing, approaching breakout zone.',
        riskLevel: 'MEDIUM',
      },
    ],
  },
  HIGH: {
    analysis: 'Using fallback suggestions. AI or market data service is currently unavailable.',
    suggestions: [
      {
        pair: 'PEPE/USDT',
        direction: 'LONG',
        duration: '1–4 hours',
        reason: 'Massive volume spike, meme season momentum, high risk/reward.',
        riskLevel: 'HIGH',
      },
      {
        pair: 'WIF/USDT',
        direction: 'SHORT',
        duration: '2–6 hours',
        reason: 'Parabolic run losing steam, RSI overbought, sharp correction likely.',
        riskLevel: 'HIGH',
      },
      {
        pair: 'DOGE/USDT',
        direction: 'LONG',
        duration: '4–12 hours',
        reason: 'Social media surge detected, high volatility window opening.',
        riskLevel: 'HIGH',
      },
    ],
  },
};

@Injectable()
export class DefaultSuggestionEngineService implements SuggestionEngine {
  private readonly logger = new Logger(DefaultSuggestionEngineService.name);

  constructor(private readonly ai: AiService) {}

  async suggest(input: SuggestionInput): Promise<SuggestionOutput> {
    try {
      const prompt = this.buildPrompt(input);
      const response = await this.ai.complete(prompt);
      return this.parseResponse(response, input.riskAppetite);
    } catch (err) {
      this.logger.warn(`AI suggestions failed, using fallback: ${(err as Error).message}`);
      return FALLBACK[input.riskAppetite];
    }
  }

  private buildPrompt(input: SuggestionInput): string {
    const riskDescriptions: Record<string, string> = {
      LOW: 'conservative — prefer large caps (BTC, ETH), multi-day holds, minimal drawdown risk',
      MEDIUM: 'moderate — swing trades on mid/large caps, hold for hours to a few days',
      HIGH: 'aggressive — small caps and meme coins acceptable, short-term trades, high volatility ok',
    };

    const marketLines = input.marketData
      .map(
        (c) =>
          `${c.pair} | price: $${c.price.toLocaleString()} | 24h: ${c.change24h >= 0 ? '+' : ''}${c.change24h.toFixed(2)}% | vol: $${(c.volume24h / 1e6).toFixed(0)}M`,
      )
      .join('\n');

    return `You are a crypto trading advisor. Analyse the market data below and suggest exactly 3 trading pairs.

Risk appetite: ${input.riskPct}% (${input.riskAppetite} — ${riskDescriptions[input.riskAppetite]})

Current market data (top 30 by market cap):
${marketLines}

Instructions:
1. Write a short analysis (3-5 sentences) explaining what you observe in the market data and how the risk appetite of ${input.riskPct}% shapes your picks.
2. Then select exactly 3 pairs that best fit this risk level.
3. For each pair, direction must be "LONG" or "SHORT", riskLevel must be "${input.riskAppetite}".

Respond ONLY with valid JSON in this exact shape, no markdown fences, no extra text:
{
  "analysis": "Your market observations and reasoning here...",
  "suggestions": [
    {"pair":"BTC/USDT","direction":"LONG","duration":"3-7 days","reason":"...","riskLevel":"${input.riskAppetite}"}
  ]
}`;
  }

  private parseResponse(raw: string, riskAppetite: string): SuggestionOutput {
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

    const suggestions: SuggestionItem[] = parsed.suggestions.map(
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
          riskLevel: riskAppetite as SuggestionItem['riskLevel'],
        };
      },
    );

    return { analysis: parsed.analysis.trim(), suggestions };
  }
}
