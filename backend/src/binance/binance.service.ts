import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import type { Candle, CandleInterval } from './binance.types';

const BASE = 'https://api.binance.com/api/v3';

// Binance uses BTCUSDT format; we use BTC/USDT internally
function toSymbol(pair: string): string {
  return pair.replace('/', '');
}

function signRequest(secret: string, queryString: string): string {
  return createHmac('sha256', secret).update(queryString).digest('hex');
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

  /**
   * Get USDT balance (signed request, requires user API keys).
   */
  async getUsdtBalance(apiKey: string, apiSecret: string): Promise<number> {
    const timestamp = Date.now();
    const query = `timestamp=${timestamp}`;
    const signature = signRequest(apiSecret, query);
    const url = `${BASE}/account?${query}&signature=${signature}`;

    const res = await fetch(url, {
      headers: { 'X-MBX-APIKEY': apiKey },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Binance account failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as { balances: Array<{ asset: string; free: string; locked: string }> };
    const usdt = data.balances.find((b) => b.asset === 'USDT');
    return usdt ? parseFloat(usdt.free) + parseFloat(usdt.locked) : 0;
  }

  /**
   * Place spot market order (signed request).
   * For LONG: BUY base. quantity = amountUsdt / price.
   * For SHORT: not supported for spot (would need futures).
   */
  async placeSpotMarketOrder(
    apiKey: string,
    apiSecret: string,
    pair: string,
    side: 'BUY' | 'SELL',
    quantity: number,
  ): Promise<{ fillPrice: number; fillQty: number }> {
    const symbol = toSymbol(pair);
    const timestamp = Date.now();
    const params = new URLSearchParams({
      symbol,
      side,
      type: 'MARKET',
      quantity: quantity.toFixed(8),
      timestamp: String(timestamp),
    });
    const signature = signRequest(apiSecret, params.toString());

    const res = await fetch(`${BASE}/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-MBX-APIKEY': apiKey,
      },
      body: `${params.toString()}&signature=${signature}`,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Binance order failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as {
      fills?: Array<{ price: string; qty: string }>;
      executedQty?: string;
    };
    const fills = data.fills ?? [];
    const fillPrice = fills.length > 0
      ? fills.reduce((sum, f) => sum + parseFloat(f.price) * parseFloat(f.qty), 0) /
        fills.reduce((sum, f) => sum + parseFloat(f.qty), 0)
      : 0;
    const fillQty = parseFloat(data.executedQty ?? '0');
    return { fillPrice, fillQty };
  }

  /**
   * Fetch more than 1000 candles by paginating backwards from now.
   * Uses a small delay between pages to respect Binance rate limits.
   * Zero cost — Binance public endpoint.
   */
  async getCandlesPaginated(
    pair: string,
    interval: CandleInterval,
    total: number,
    delayMs = 300,
  ): Promise<Candle[]> {
    if (total <= 1000) return this.getCandles(pair, interval, total);

    const symbol = toSymbol(pair);
    const pages: Candle[][] = [];
    let endTime: number | undefined;
    let remaining = total;

    while (remaining > 0) {
      const limit = Math.min(remaining, 1000);
      const params = new URLSearchParams({ symbol, interval, limit: String(limit) });
      if (endTime !== undefined) params.set('endTime', String(endTime));
      const url = `${BASE}/klines?${params.toString()}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Binance klines failed for ${pair}: ${res.status}`);

      const raw = (await res.json()) as unknown[][];
      if (!raw.length) break;

      const batch: Candle[] = raw.map((k) => ({
        time: k[0] as number,
        open: parseFloat(k[1] as string),
        high: parseFloat(k[2] as string),
        low: parseFloat(k[3] as string),
        close: parseFloat(k[4] as string),
        volume: parseFloat(k[5] as string),
      }));

      pages.unshift(batch); // prepend so oldest comes first
      endTime = batch[0].time - 1; // next page ends just before this batch's oldest candle
      remaining -= batch.length;
      if (batch.length < limit) break; // reached start of available history

      if (remaining > 0) await new Promise((r) => setTimeout(r, delayMs));
    }

    // Flatten and deduplicate by time
    const seen = new Set<number>();
    const result: Candle[] = [];
    for (const batch of pages) {
      for (const c of batch) {
        if (!seen.has(c.time)) { seen.add(c.time); result.push(c); }
      }
    }
    return result;
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
