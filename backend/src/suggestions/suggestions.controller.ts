import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { IsEnum } from 'class-validator';
import { RiskAppetite, TradeDirection } from '../common/types/enums';

class GetSuggestionsDto {
  @IsEnum(RiskAppetite)
  riskAppetite: RiskAppetite;
}

export type Suggestion = {
  pair: string;
  direction: TradeDirection;
  duration: string;
  reason: string;
  riskLevel: RiskAppetite;
};

const DUMMY_SUGGESTIONS: Record<RiskAppetite, Suggestion[]> = {
  LOW: [
    { pair: 'BTC/USDT', direction: 'LONG', duration: '3–7 days', reason: 'Strong support at current level, low volatility, steady uptrend.', riskLevel: 'LOW' },
    { pair: 'ETH/USDT', direction: 'LONG', duration: '2–5 days', reason: 'Consolidating above key MA, volume stable, low drawdown risk.', riskLevel: 'LOW' },
    { pair: 'BNB/USDT', direction: 'LONG', duration: '3–6 days', reason: 'Slow grind upward, RSI neutral, tight range with clear support.', riskLevel: 'LOW' },
  ],
  MEDIUM: [
    { pair: 'SOL/USDT', direction: 'LONG', duration: '1–3 days', reason: 'RSI recovering from oversold, volume spike, breakout pattern forming.', riskLevel: 'MEDIUM' },
    { pair: 'AVAX/USDT', direction: 'SHORT', duration: '4–8 hours', reason: 'Rejected resistance twice, momentum fading, local top likely.', riskLevel: 'MEDIUM' },
    { pair: 'MATIC/USDT', direction: 'LONG', duration: '1–2 days', reason: 'Higher lows forming, volume increasing, approaching breakout zone.', riskLevel: 'MEDIUM' },
  ],
  HIGH: [
    { pair: 'PEPE/USDT', direction: 'LONG', duration: '1–4 hours', reason: 'Massive volume spike, meme season momentum, high risk/reward.', riskLevel: 'HIGH' },
    { pair: 'WIF/USDT', direction: 'SHORT', duration: '2–6 hours', reason: 'Parabolic run losing steam, RSI overbought, sharp correction likely.', riskLevel: 'HIGH' },
    { pair: 'DOGE/USDT', direction: 'LONG', duration: '4–12 hours', reason: 'Social media surge detected, high volatility window opening.', riskLevel: 'HIGH' },
  ],
};

@Controller('suggestions')
export class SuggestionsController {
  @Post()
  @HttpCode(HttpStatus.OK)
  getSuggestions(@Body() dto: GetSuggestionsDto): Suggestion[] {
    return DUMMY_SUGGESTIONS[dto.riskAppetite];
  }
}
