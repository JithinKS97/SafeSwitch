import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import type {
  SuggestionEngine,
  SuggestionInput,
  SuggestionOutput,
  SuggestionItem,
} from './suggestion-engine.interface';

@Injectable()
export class DefaultSuggestionEngineService implements SuggestionEngine {
  constructor(private readonly ai: AiService) {}

  async suggest(input: SuggestionInput): Promise<SuggestionOutput> {
    const prompt = this.buildPrompt(input);
    const response = await this.ai.complete(prompt, input.userId);
    return this.parseResponse(response, input.riskAppetite);
  }

  private buildPrompt(input: SuggestionInput): string {
    const riskDescriptions: Record<string, string> = {
      LOW: 'conservative — prefer large caps (BTC, ETH), multi-day holds, minimal drawdown risk',
      MEDIUM: 'moderate — swing trades on mid/large caps, hold for hours to a few days',
      HIGH: 'aggressive — small caps and meme coins acceptable, short-term trades, high volatility ok',
    };

    const hasSignals = input.marketData.some((c) => c.signalScore != null);

    const marketLines = input.marketData
      .map((c) => {
        const base = `${c.pair} | price: $${c.price.toLocaleString()} | 24h: ${c.change24h >= 0 ? '+' : ''}${c.change24h.toFixed(2)}% | vol: $${(c.volume24h / 1e6).toFixed(0)}M`;
        if (c.signalScore != null) {
          return `${base} | signal: ${c.signalScore}/100 ${c.signalDirection ?? ''} [${c.signalLabel ?? ''}] — ${c.signalSummary ?? ''}`;
        }
        return base;
      })
      .join('\n');

    const signalNote = hasSignals
      ? `\nSignal scores (0–100) are pre-computed from technical indicators (EMA trend, MACD momentum, RSI, Bollinger bands, regression model, volume). Higher score = stronger mathematical conviction. Pairs are listed with highest signals first. Only include a pair if its signal genuinely supports the trade — fewer strong picks beat more weak ones.\n`
      : '';

    return `You are a crypto trading advisor. Analyse the market data below and suggest the best trading pairs for this risk level.

Risk appetite: ${input.riskPct}/10 (${input.riskAppetite} — ${riskDescriptions[input.riskAppetite]})
${signalNote}
Current market data (top 30 by market cap, sorted by signal strength where available):
${marketLines}

Instructions:
1. Write a short analysis (3-5 sentences) explaining what you observe in the market data${hasSignals ? ', what the signal scores indicate,' : ''} and how the risk level (${input.riskPct}/10) shapes your picks.
2. Select only the pairs where you have genuine conviction for this risk level. Do not pad the list — suggest fewer pairs if the market doesn't offer enough clear setups. Aim for 3–6 suggestions.
3. For each pair, direction must be "LONG" or "SHORT", riskLevel must be "${input.riskAppetite}".
${hasSignals ? '4. Prefer pairs where the signal direction matches the trade direction and the score is strong for the risk level (HIGH risk can tolerate lower scores; LOW risk should prefer clearer signals).' : ''}

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
