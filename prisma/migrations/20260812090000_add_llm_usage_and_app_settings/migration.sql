-- AlterEnum
ALTER TYPE "AdminAuditAction" ADD VALUE IF NOT EXISTS 'llm_model_changed';

-- CreateTable
CREATE TABLE "llm_usage" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "user_id" TEXT,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DECIMAL(14,10) NOT NULL DEFAULT 0,
    "latency_ms" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "llm_usage_created_at_idx" ON "llm_usage"("created_at" DESC);

-- CreateIndex
CREATE INDEX "llm_usage_feature_created_at_idx" ON "llm_usage"("feature", "created_at");

-- CreateIndex
CREATE INDEX "llm_usage_model_created_at_idx" ON "llm_usage"("model", "created_at");
