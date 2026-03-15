-- AlterTable
ALTER TABLE "pair_journal_entries" ADD COLUMN     "mathAnalysis" JSONB;

-- AlterTable
ALTER TABLE "pair_journals" ADD COLUMN     "worksheet" JSONB;
