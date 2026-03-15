-- CreateTable
CREATE TABLE "suggestion_snapshots" (
    "id" TEXT NOT NULL,
    "riskPct" INTEGER NOT NULL,
    "analysis" TEXT NOT NULL,
    "suggestions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suggestion_snapshots_pkey" PRIMARY KEY ("id")
);
