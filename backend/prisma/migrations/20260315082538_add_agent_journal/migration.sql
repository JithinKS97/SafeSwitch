-- AlterTable
ALTER TABLE "positions" ADD COLUMN     "agentOpened" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "agent_journal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycleNum" INTEGER NOT NULL,
    "entry" TEXT NOT NULL,
    "decisions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_journal_pkey" PRIMARY KEY ("id")
);
