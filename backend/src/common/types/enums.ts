/**
 * Local enum definitions mirroring prisma/schema.prisma.
 * These match exactly what Prisma generates in @prisma/client.
 * Once `prisma generate` has been run, imports can be switched
 * to `@prisma/client` directly.
 */

export const RiskAppetite = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;
export type RiskAppetite = (typeof RiskAppetite)[keyof typeof RiskAppetite];

export const TradeDirection = {
  LONG: 'LONG',
  SHORT: 'SHORT',
} as const;
export type TradeDirection = (typeof TradeDirection)[keyof typeof TradeDirection];

export const TradingMode = {
  PAPER: 'PAPER',
  LIVE: 'LIVE',
} as const;
export type TradingMode = (typeof TradingMode)[keyof typeof TradingMode];

export const PositionStatus = {
  INACTIVE: 'INACTIVE',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  STOPPED: 'STOPPED',
} as const;
export type PositionStatus = (typeof PositionStatus)[keyof typeof PositionStatus];

export const CloseReason = {
  PROFIT_TARGET: 'PROFIT_TARGET',
  DRAWDOWN_LIMIT: 'DRAWDOWN_LIMIT',
  MANUAL: 'MANUAL',
} as const;
export type CloseReason = (typeof CloseReason)[keyof typeof CloseReason];

export const TradeSide = {
  BUY: 'BUY',
  SELL: 'SELL',
} as const;
export type TradeSide = (typeof TradeSide)[keyof typeof TradeSide];
