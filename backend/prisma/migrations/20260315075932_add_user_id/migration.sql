-- Wipe existing data before adding non-nullable userId columns
DELETE FROM "trades";
DELETE FROM "suggestion_snapshots";
DELETE FROM "positions";

-- Add userId to positions
ALTER TABLE "positions" ADD COLUMN "userId" TEXT NOT NULL;

-- Add userId to suggestion_snapshots
ALTER TABLE "suggestion_snapshots" ADD COLUMN "userId" TEXT NOT NULL;
