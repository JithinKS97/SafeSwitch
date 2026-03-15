-- Convert riskPct from 0-100 scale to 0-10 scale for existing suggestion snapshots
UPDATE "suggestion_snapshots"
SET "riskPct" = ROUND("riskPct" / 10.0)::INTEGER
WHERE "riskPct" > 10;
