-- CreateTable
CREATE TABLE "pair_journals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pair" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pair_journals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pair_journal_entries" (
    "id" TEXT NOT NULL,
    "pairJournalId" TEXT NOT NULL,
    "cycleNum" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "outcome" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pair_journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pair_journals_userId_pair_key" ON "pair_journals"("userId", "pair");

-- AddForeignKey
ALTER TABLE "pair_journal_entries" ADD CONSTRAINT "pair_journal_entries_pairJournalId_fkey" FOREIGN KEY ("pairJournalId") REFERENCES "pair_journals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
