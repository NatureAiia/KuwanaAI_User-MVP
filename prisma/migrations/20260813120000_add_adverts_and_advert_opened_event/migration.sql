-- AlterEnum
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'advert_opened';

-- CreateTable
CREATE TABLE "adverts" (
    "id" TEXT NOT NULL,
    "sponsor_name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adverts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "adverts_active_idx" ON "adverts"("active");
