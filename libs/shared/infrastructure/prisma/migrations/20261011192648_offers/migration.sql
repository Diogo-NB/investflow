/*
  Warnings:

  - You are about to drop the `investment_offer` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "simulation" DROP CONSTRAINT "simulation_source_offer_id_fkey";

-- DropTable
DROP TABLE "investment_offer";

-- CreateTable
CREATE TABLE "offer" (
    "id" UUID NOT NULL,
    "owner_id" TEXT,
    "title_type" "investment_title_type" NOT NULL,
    "name" TEXT NOT NULL,
    "issuer_name" TEXT,
    "maturity_date" DATE NOT NULL,
    "redemption_type" "investment_redemption_type" NOT NULL,
    "remuneration_type" "investment_remuneration_type" NOT NULL,
    "rate_value" DECIMAL(65,30) NOT NULL,
    "revision" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "offer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "offer_owner_id_idx" ON "offer"("owner_id");

-- AddForeignKey
ALTER TABLE "simulation" ADD CONSTRAINT "simulation_source_offer_id_fkey" FOREIGN KEY ("source_offer_id") REFERENCES "offer"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
