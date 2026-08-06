-- CreateTable
CREATE TABLE "recommendation_cache" (
    "cache_key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendation_cache_pkey" PRIMARY KEY ("cache_key")
);

-- CreateIndex
CREATE INDEX "recommendation_cache_expires_at_idx" ON "recommendation_cache"("expires_at");

