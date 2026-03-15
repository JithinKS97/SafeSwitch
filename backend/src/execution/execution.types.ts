import { CloseReason } from '../common/types/enums';

/** Result of an entry execution (paper or live) */
export type EnterResult = {
  success: boolean;
  mode: 'PAPER' | 'LIVE';
  entryPrice: number;
  /** For live: order ID from exchange */
  orderId?: string;
};

/** Result of an exit execution (paper or live) */
export type ExitResult = {
  success: boolean;
  mode: 'PAPER' | 'LIVE';
  pnl: number;
  currentPrice: number;
  reason: CloseReason;
  /** For live: order ID from exchange */
  orderId?: string;
};
