/*
  Warnings:

  - You are about to drop the column `issuer_name` on the `simulation` table. All the data in the column will be lost.
  - You are about to drop the column `maturity_date` on the `simulation` table. All the data in the column will be lost.
  - You are about to drop the column `rate_value` on the `simulation` table. All the data in the column will be lost.
  - You are about to drop the column `redemption_type` on the `simulation` table. All the data in the column will be lost.
  - You are about to drop the column `remuneration_type` on the `simulation` table. All the data in the column will be lost.
  - You are about to drop the column `source_offer_id` on the `simulation` table. All the data in the column will be lost.
  - You are about to drop the column `title_type` on the `simulation` table. All the data in the column will be lost.
  - You are about to drop the `simulation_calculation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `simulation_calculation_balance` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `investment_date` to the `simulation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `offer_id` to the `simulation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `principal` to the `simulation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `revision` to the `simulation` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "simulation" DROP CONSTRAINT "simulation_source_offer_id_fkey";

-- DropForeignKey
ALTER TABLE "simulation_calculation" DROP CONSTRAINT "simulation_calculation_curve_id_fkey";

-- DropForeignKey
ALTER TABLE "simulation_calculation" DROP CONSTRAINT "simulation_calculation_simulation_id_fkey";

-- DropForeignKey
ALTER TABLE "simulation_calculation_balance" DROP CONSTRAINT "simulation_calculation_balance_calculation_id_fkey";

-- AlterTable
ALTER TABLE "simulation" DROP COLUMN "issuer_name",
DROP COLUMN "maturity_date",
DROP COLUMN "rate_value",
DROP COLUMN "redemption_type",
DROP COLUMN "remuneration_type",
DROP COLUMN "source_offer_id",
DROP COLUMN "title_type",
ADD COLUMN     "curve_id" UUID,
ADD COLUMN     "investment_date" DATE NOT NULL,
ADD COLUMN     "offer_id" UUID NOT NULL,
ADD COLUMN     "principal" DECIMAL(65,30) NOT NULL,
ADD COLUMN     "revision" INTEGER NOT NULL;

-- DropTable
DROP TABLE "simulation_calculation";

-- DropTable
DROP TABLE "simulation_calculation_balance";

-- CreateTable
CREATE TABLE "simulation_result" (
    "simulation_id" UUID NOT NULL,
    "simulation_revision" INTEGER NOT NULL,
    "offer_revision" INTEGER NOT NULL,
    "curve_revision" INTEGER,
    "methodology_version" TEXT NOT NULL,
    "calculated_at" TIMESTAMPTZ(3) NOT NULL,
    "investment_date" DATE NOT NULL,
    "maturity_date" DATE NOT NULL,
    "principal" DECIMAL(65,30) NOT NULL,
    "gross_balance" DECIMAL(65,30) NOT NULL,
    "gross_earnings" DECIMAL(65,30) NOT NULL,
    "iof" DECIMAL(65,30) NOT NULL,
    "income_tax" DECIMAL(65,30) NOT NULL,
    "total_taxes" DECIMAL(65,30) NOT NULL,
    "net_balance" DECIMAL(65,30) NOT NULL,
    "holding_period_calendar_days" INTEGER NOT NULL,
    "taxable_earnings" DECIMAL(65,30) NOT NULL,
    "income_tax_base" DECIMAL(65,30) NOT NULL,
    "iof_rate" DECIMAL(65,30),
    "income_tax_rate" DECIMAL(65,30),

    CONSTRAINT "simulation_result_pkey" PRIMARY KEY ("simulation_id")
);

-- CreateTable
CREATE TABLE "simulation_result_balance" (
    "simulation_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "gross_balance" DECIMAL(65,30) NOT NULL,
    "daily_gross_earnings" DECIMAL(65,30) NOT NULL,
    "accumulated_gross_earnings" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "simulation_result_balance_pkey" PRIMARY KEY ("simulation_id","date")
);

-- CreateIndex
CREATE INDEX "simulation_offer_id_idx" ON "simulation"("offer_id");

-- CreateIndex
CREATE INDEX "simulation_curve_id_idx" ON "simulation"("curve_id");

-- AddForeignKey
ALTER TABLE "simulation" ADD CONSTRAINT "simulation_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offer"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "simulation" ADD CONSTRAINT "simulation_curve_id_fkey" FOREIGN KEY ("curve_id") REFERENCES "curve"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "simulation_result" ADD CONSTRAINT "simulation_result_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "simulation"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "simulation_result_balance" ADD CONSTRAINT "simulation_result_balance_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "simulation_result"("simulation_id") ON DELETE RESTRICT ON UPDATE RESTRICT;
