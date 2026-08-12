-- CreateTable
CREATE TABLE "pinned_listings" (
    "user_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "pinned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pinned_listings_pkey" PRIMARY KEY ("user_id","listing_id")
);

-- CreateIndex
CREATE INDEX "pinned_listings_user_id_pinned_at_idx" ON "pinned_listings"("user_id", "pinned_at" DESC);

-- AddForeignKey
ALTER TABLE "pinned_listings" ADD CONSTRAINT "pinned_listings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pinned_listings" ADD CONSTRAINT "pinned_listings_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
