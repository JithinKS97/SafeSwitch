-- CreateEnum
CREATE TYPE "RiskAppetite" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TradeDirection" AS ENUM ('LONG', 'SHORT');

-- CreateEnum
CREATE TYPE "TradingMode" AS ENUM ('PAPER', 'LIVE');

-- CreateEnum
CREATE TYPE "PositionStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'COMPLETED', 'STOPPED');

-- CreateEnum
CREATE TYPE "TradeSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "CloseReason" AS ENUM ('PROFIT_TARGET', 'DRAWDOWN_LIMIT', 'MANUAL');

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "pair" TEXT NOT NULL,
    "direction" "TradeDirection" NOT NULL,
    "riskAppetite" "RiskAppetite" NOT NULL,
    "status" "PositionStatus" NOT NULL DEFAULT 'INACTIVE',
    "mode" "TradingMode" NOT NULL DEFAULT 'PAPER',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "entryPrice" DOUBLE PRECISION,
    "currentPrice" DOUBLE PRECISION,
    "closeReason" "CloseReason",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "side" "TradeSide" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "mode" "TradingMode" NOT NULL,
    "pnl" DOUBLE PRECISION,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
