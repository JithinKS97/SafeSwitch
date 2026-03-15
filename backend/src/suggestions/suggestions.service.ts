import { BadRequestException, Injectable, Inject, Logger } from '@nestjs/common';
import { RiskAppetite } from '../common/types/enums';
import { MarketDataService } from '../market-data/market-data.service';
import { BinanceService } from '../binance/binance.service';
import { IndicatorsService } from '../indicators/indicators.service';
import { SIGNAL_ENGINE, type SignalEngine } from '../signals/signal-engine.interface';
import { SuggestionsRepository } from './suggestions.repository';
import { SUGGESTION_ENGINE, type SuggestionEngine, type ScoredMarketDataPoint } from '../suggestion-engine/suggestion-engine.interface';
import type { Suggestion, SuggestionsResponse, SnapshotSummary } from './suggestions.types';

function riskToAppetite(risk: number): RiskAppetite {
  if (risk <= 3) return 'LOW';
  if (risk <= 6) return 'MEDIUM';
  return 'HIGH';
}

@Injectable()
export class SuggestionsService {
  private readonly logger = new Logger(SuggestionsService.name);

  constructor(
    private readonly marketData: MarketDataService,
    private readonly binance: BinanceService,
    private readonly indicators: IndicatorsService,
    @Inject(SIGNAL_ENGINE) private readonly signalEngine: SignalEngine,
    @Inject(SUGGESTION_ENGINE) private readonly suggestionEngine: SuggestionEngine,
    private readonly repo: SuggestionsRepository,
  ) {}

  async getSuggestions(riskPct: number, userId: string): Promise<SuggestionsResponse> {
    const riskAppetite = riskToAppetite(riskPct);
    try {
      const coins = await this.marketData.getTopCoins();
      const scoredData = await this.attachSignals(coins);
      // Sort by signal score descending so the LLM sees the strongest signals first
      scoredData.sort((a, b) => (b.signalScore ?? 0) - (a.signalScore ?? 0));

      const result = await this.suggestionEngine.suggest({ riskPct, riskAppetite, marketData: scoredData });
      const saved = await this.repo.save(userId, riskPct, result.analysis, result.suggestions);
      return { ...result, id: saved.id, createdAt: saved.createdAt.toISOString() };
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.warn(`Suggestions failed: ${msg}`);
      throw new BadRequestException(msg);
    }
  }

  async refresh(id: string, userId: string): Promise<SuggestionsResponse> {
    const existing = await this.repo.findById(id, userId);
    if (!existing) throw new BadRequestException(`Snapshot ${id} not found`);
    return this.getSuggestions(existing.riskPct, userId);
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

  // ─── Private helpers ─────────────────────────────────────────────────────────

  /**
   * For each coin, attempt to fetch candles → compute worksheet → score signal.
   * Failures are silent — we fall back to plain MarketDataPoint without a score.
   * Candle fetches are parallelised with a concurrency cap to avoid rate limits.
   */
  private async attachSignals(
    coins: Array<{ pair: string; price: number; change24h: number; volume24h: number }>,
  ): Promise<ScoredMarketDataPoint[]> {
    const CONCURRENCY = 5;
    const results: ScoredMarketDataPoint[] = new Array(coins.length);

    for (let i = 0; i < coins.length; i += CONCURRENCY) {
      const batch = coins.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (coin, batchIdx) => {
          const idx = i + batchIdx;
          const base: ScoredMarketDataPoint = {
            pair: coin.pair,
            price: coin.price,
            change24h: coin.change24h,
            volume24h: coin.volume24h,
          };
          try {
            const [candleMap, candle4hMap] = await Promise.all([
              this.binance.getCandlesForPairs([coin.pair], '1h', 200),
              this.binance.getCandlesForPairs([coin.pair], '4h', 100),
            ]);
            const candles = candleMap[coin.pair];
            if (!candles?.length) {
              results[idx] = base;
              return;
            }
            let ws = this.indicators.compute(0, candles);
            const c4h = candle4hMap[coin.pair];
            if (c4h?.length) ws = this.indicators.enrich4h(ws, c4h);
            const long = this.signalEngine.score(coin.pair, ws, 'LONG');
            const short = this.signalEngine.score(coin.pair, ws, 'SHORT');
            const best = long.score >= short.score ? long : short;
            results[idx] = {
              ...base,
              signalScore: best.score,
              signalDirection: best.direction,
              signalLabel: best.label,
              signalSummary: best.summary,
            };
          } catch {
            results[idx] = base;
          }
        }),
      );
    }

    return results;
  }
}
