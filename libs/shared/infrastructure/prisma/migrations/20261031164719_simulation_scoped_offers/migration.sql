-- CreateEnum
CREATE TYPE "offer_scope" AS ENUM ('CATALOG', 'SIMULATION');

-- AlterEnum
ALTER TYPE "simulation_calculation_cause_kind" ADD VALUE 'PREMISES_CHANGED';

-- AlterTable
ALTER TABLE "offer" ADD COLUMN     "based_on_offer_id" UUID,
ADD COLUMN     "scope" "offer_scope" NOT NULL DEFAULT 'CATALOG';

-- AddForeignKey
ALTER TABLE "offer" ADD CONSTRAINT "offer_based_on_offer_id_fkey" FOREIGN KEY ("based_on_offer_id") REFERENCES "offer"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
