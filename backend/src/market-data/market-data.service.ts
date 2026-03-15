import { Injectable, Logger } from '@nestjs/common';
import type { CoinSnapshot } from './market-data.types';

const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/coins/markets' +
  '?vs_currency=usd&order=market_cap_desc&per_page=30&page=1' +
  '&sparkline=false&price_change_percentage=24h';

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);
  private readonly TTL_MS = 5 * 60 * 1000;
  private cache: { data: CoinSnapshot[]; fetchedAt: number } | null = null;

  async getTopCoins(): Promise<CoinSnapshot[]> {
    if (this.cache && Date.now() - this.cache.fetchedAt < this.TTL_MS) {
      this.logger.debug('Returning cached market data');
      return this.cache.data;
    }

    this.logger.log('Fetching market data from CoinGecko');
    const res = await fetch(COINGECKO_URL);

    if (!res.ok) {
      throw new Error(`CoinGecko request failed: ${res.status} ${res.statusText}`);
    }

    const raw = (await res.json()) as Array<{
      symbol: string;
      current_price: number;
      price_change_percentage_24h: number;
      total_volume: number;
      market_cap: number;
    }>;

    const data: CoinSnapshot[] = raw.map((coin) => ({
      symbol: coin.symbol.toUpperCase(),
      pair: `${coin.symbol.toUpperCase()}/USDT`,
      price: coin.current_price,
      change24h: coin.price_change_percentage_24h ?? 0,
      volume24h: coin.total_volume,
      marketCap: coin.market_cap,
    }));

    this.cache = { data, fetchedAt: Date.now() };
    return data;
  }
}
