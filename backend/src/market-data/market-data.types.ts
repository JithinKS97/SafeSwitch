export type CoinSnapshot = {
  symbol: string;   // e.g. "BTC"
  pair: string;     // e.g. "BTC/USDT"
  price: number;
  change24h: number; // percentage, e.g. 2.5 means +2.5%
  volume24h: number;
  marketCap: number;
};
