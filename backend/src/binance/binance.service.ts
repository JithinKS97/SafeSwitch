import { Injectable, Logger } from '@nestjs/common';
import type { Candle, CandleInterval } from './binance.types';

const BASE = 'https://api.binance.com/api/v3';

// Binance uses BTCUSDT format; we use BTC/USDT internally
function toSymbol(pair: string): string {
  return pair.replace('/', '');
}

@Injectable()
export class BinanceService {
  private readonly logger = new Logger(BinanceService.name);

  async getCandles(
    pair: string,
    interval: CandleInterval = '1h',
    limit = 48,
  ): Promise<Candle[]> {
    const symbol = toSymbol(pair);
    const url = `${BASE}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Binance klines failed for ${pair}: ${res.status}`);
    }

    const raw = (await res.json()) as unknown[][];
    return raw.map((k) => ({
      time: k[0] as number,
      open: parseFloat(k[1] as string),
      high: parseFloat(k[2] as string),
      low: parseFloat(k[3] as string),
      close: parseFloat(k[4] as string),
      volume: parseFloat(k[5] as string),
    }));
  }

  async getCurrentPrice(pair: string): Promise<number> {
    const symbol = toSymbol(pair);
    const url = `${BASE}/ticker/price?symbol=${symbol}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Binance price failed for ${pair}: ${res.status}`);
    }

    const data = (await res.json()) as { price: string };
    return parseFloat(data.price);
  }

  // Returns candles for multiple pairs, silently skipping any that fail
  async getCandlesForPairs(
    pairs: string[],
    interval: CandleInterval = '1h',
    limit = 48,
  ): Promise<Record<string, Candle[]>> {
    const results: Record<string, Candle[]> = {};

    await Promise.all(
      pairs.map(async (pair) => {
        try {
          results[pair] = await this.getCandles(pair, interval, limit);
        } catch (err) {
          this.logger.warn(`Skipping candles for ${pair}: ${(err as Error).message}`);
        }
      }),
    );

    return results;
  }
}
