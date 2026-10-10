-- AlterTable
ALTER TABLE "investment_offer" ADD COLUMN     "source_offer_id" UUID;

-- CreateTable
CREATE TABLE "investment_application" (
    "id" UUID NOT NULL,
    "owner_id" TEXT NOT NULL,
    "offer_snapshot_id" UUID NOT NULL,
    "index_curve_id" UUID,
    "principal" DECIMAL(65,30) NOT NULL,
    "investment_date" DATE NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "investment_application_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "investment_application_owner_id_idx" ON "investment_application"("owner_id");

-- CreateIndex
CREATE INDEX "investment_offer_source_offer_id_idx" ON "investment_offer"("source_offer_id");

-- AddForeignKey
ALTER TABLE "investment_offer" ADD CONSTRAINT "investment_offer_source_offer_id_fkey" FOREIGN KEY ("source_offer_id") REFERENCES "investment_offer"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "investment_application" ADD CONSTRAINT "investment_application_offer_snapshot_id_fkey" FOREIGN KEY ("offer_snapshot_id") REFERENCES "investment_offer"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "investment_application" ADD CONSTRAINT "investment_application_index_curve_id_fkey" FOREIGN KEY ("index_curve_id") REFERENCES "index_curve"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
