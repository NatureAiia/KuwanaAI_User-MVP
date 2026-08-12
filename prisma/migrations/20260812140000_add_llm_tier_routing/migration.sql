-- Tier routing columns. Existing rows predate tiering and were all single-shot
-- calls, so the attempt default of 1 describes them correctly; complexity is
-- nullable because no score was computed for them.
ALTER TABLE "llm_usage" ADD COLUMN IF NOT EXISTS "attempt" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "llm_usage" ADD COLUMN IF NOT EXISTS "escalated_from" TEXT;
ALTER TABLE "llm_usage" ADD COLUMN IF NOT EXISTS "complexity" DOUBLE PRECISION;
