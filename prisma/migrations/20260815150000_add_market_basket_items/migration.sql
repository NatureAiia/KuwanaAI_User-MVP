-- AlterEnum
ALTER TYPE "AdminAuditAction" ADD VALUE 'market_basket_item_created';
ALTER TYPE "AdminAuditAction" ADD VALUE 'market_basket_item_deleted';

-- CreateTable
CREATE TABLE "market_basket_items" (
    "id" TEXT NOT NULL,
    "basket_name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "weight" DECIMAL(6,3) NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_basket_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "market_basket_items_basket_name_idx" ON "market_basket_items"("basket_name");

-- CreateIndex
CREATE UNIQUE INDEX "market_basket_items_basket_name_listing_id_key" ON "market_basket_items"("basket_name", "listing_id");

-- AddForeignKey
ALTER TABLE "market_basket_items" ADD CONSTRAINT "market_basket_items_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
