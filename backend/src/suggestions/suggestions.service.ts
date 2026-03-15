import { BadRequestException, Injectable, Inject, Logger } from '@nestjs/common';
import { RiskAppetite } from '../common/types/enums';
import { MarketDataService } from '../market-data/market-data.service';
import { SuggestionsRepository } from './suggestions.repository';
import { SUGGESTION_ENGINE, type SuggestionEngine } from '../suggestion-engine/suggestion-engine.interface';
import type { Suggestion, SuggestionsResponse, SnapshotSummary } from './suggestions.types';

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
    @Inject(SUGGESTION_ENGINE) private readonly suggestionEngine: SuggestionEngine,
    private readonly repo: SuggestionsRepository,
  ) {}

  async getSuggestions(riskPct: number, userId: string): Promise<SuggestionsResponse> {
    const riskAppetite = pctToRiskAppetite(riskPct);
    try {
      const coins = await this.marketData.getTopCoins();
      const marketData = coins.map((c) => ({
        pair: c.pair,
        price: c.price,
        change24h: c.change24h,
        volume24h: c.volume24h,
      }));
      const result = await this.suggestionEngine.suggest({
        riskPct,
        riskAppetite,
        marketData,
      });
      const saved = await this.repo.save(userId, riskPct, result.analysis, result.suggestions);
      return { ...result, id: saved.id, createdAt: saved.createdAt.toISOString() };
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.warn(`Suggestions failed: ${msg}`);
      throw new BadRequestException(msg);
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

  async delete(id: string, userId: string): Promise<void> {
    await this.repo.delete(id, userId);
  }
}
