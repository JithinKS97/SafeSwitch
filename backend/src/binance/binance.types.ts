export type Candle = {
  time: number;   // Unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type CandleInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
