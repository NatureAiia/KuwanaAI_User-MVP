-- CreateEnum
CREATE TYPE "SentimentLabel" AS ENUM ('positive', 'negative', 'neutral');

-- AlterTable
ALTER TABLE "social_price_mentions" ADD COLUMN "sentiment" "SentimentLabel";
