-- CreateEnum
CREATE TYPE "investment_title_type" AS ENUM ('CDB', 'LCI', 'LCA');

-- CreateEnum
CREATE TYPE "investment_redemption_type" AS ENUM ('AT_MATURITY', 'DAILY');

-- CreateEnum
CREATE TYPE "investment_remuneration_type" AS ENUM ('PREFIXED', 'CDI_PERCENTAGE', 'SELIC_PERCENTAGE', 'IPCA_PLUS');

-- CreateTable
CREATE TABLE "investment_issuer" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "investment_issuer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_offer" (
    "id" UUID NOT NULL,
    "title_type" "investment_title_type" NOT NULL,
    "issuer_id" UUID NOT NULL,
    "maturity_date" DATE NOT NULL,
    "redemption_type" "investment_redemption_type" NOT NULL,
    "remuneration_type" "investment_remuneration_type" NOT NULL,
    "rate_value" DECIMAL(65,30) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "investment_offer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "investment_offer_issuer_id_idx" ON "investment_offer"("issuer_id");

-- CreateIndex
CREATE INDEX "investment_offer_deleted_at_idx" ON "investment_offer"("deleted_at");

-- AddForeignKey
ALTER TABLE "investment_offer" ADD CONSTRAINT "investment_offer_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "investment_issuer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
