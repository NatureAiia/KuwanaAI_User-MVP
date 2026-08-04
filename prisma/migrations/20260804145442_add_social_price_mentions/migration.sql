-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('telegram', 'reddit');

-- CreateTable
CREATE TABLE "social_price_mentions" (
    "id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "channel" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "posted_at" TIMESTAMP(3),
    "discovered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "text" TEXT NOT NULL,
    "matched_provider" TEXT,
    "extracted_prices" JSONB NOT NULL,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "social_price_mentions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "social_price_mentions_matched_provider_idx" ON "social_price_mentions"("matched_provider");

-- CreateIndex
CREATE UNIQUE INDEX "social_price_mentions_platform_source_url_key" ON "social_price_mentions"("platform", "source_url");
