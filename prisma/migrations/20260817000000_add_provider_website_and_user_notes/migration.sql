-- AlterTable
ALTER TABLE "providers" ADD COLUMN     "website_url" TEXT;

-- CreateTable
CREATE TABLE "user_notes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sector" "Sector" NOT NULL,
    "category" TEXT NOT NULL DEFAULT '',
    "content" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'intake',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_notes_user_id_sector_category_key" ON "user_notes"("user_id", "sector", "category");

-- AddForeignKey
ALTER TABLE "user_notes" ADD CONSTRAINT "user_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
