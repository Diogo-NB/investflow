-- CreateTable
CREATE TABLE "investment_products" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "indexer_type" TEXT NOT NULL,
    "indexer_pct" DECIMAL(10,4),
    "indexer_spread" DECIMAL(10,4),
    "rate_value" DECIMAL(10,4) NOT NULL,
    "rate_ref_type" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "minimum_amount" DECIMAL(20,4) NOT NULL,
    "total_volume" DECIMAL(20,4) NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investment_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "investment_products_organization_id_idx" ON "investment_products"("organization_id");

-- CreateIndex
CREATE INDEX "investment_products_status_idx" ON "investment_products"("status");
