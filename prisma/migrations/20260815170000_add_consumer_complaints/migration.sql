-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('open', 'reviewing', 'resolved', 'dismissed');

-- CreateTable
CREATE TABLE "consumer_complaints" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "listing_id" TEXT,
    "description" TEXT NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'open',
    "linked_investigation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumer_complaints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consumer_complaints_status_created_at_idx" ON "consumer_complaints"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "consumer_complaints_listing_id_idx" ON "consumer_complaints"("listing_id");

-- AddForeignKey
ALTER TABLE "consumer_complaints" ADD CONSTRAINT "consumer_complaints_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumer_complaints" ADD CONSTRAINT "consumer_complaints_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumer_complaints" ADD CONSTRAINT "consumer_complaints_linked_investigation_id_fkey" FOREIGN KEY ("linked_investigation_id") REFERENCES "listing_investigations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
