-- CreateTable
CREATE TABLE "fx_rates" (
    "code" TEXT NOT NULL,
    "per_usd" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("code")
);
