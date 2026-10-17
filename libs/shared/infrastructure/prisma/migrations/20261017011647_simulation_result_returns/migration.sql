/*
  Warnings:

  - Added the required column `business_days` to the `simulation_result` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gross_annual_return` to the `simulation_result` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gross_monthly_return` to the `simulation_result` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gross_period_return` to the `simulation_result` table without a default value. This is not possible if the table is not empty.
  - Added the required column `net_annual_return` to the `simulation_result` table without a default value. This is not possible if the table is not empty.
  - Added the required column `net_monthly_return` to the `simulation_result` table without a default value. This is not possible if the table is not empty.
  - Added the required column `net_period_return` to the `simulation_result` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "simulation_result" ADD COLUMN     "business_days" INTEGER NOT NULL,
ADD COLUMN     "gross_annual_return" DECIMAL(65,30) NOT NULL,
ADD COLUMN     "gross_monthly_return" DECIMAL(65,30) NOT NULL,
ADD COLUMN     "gross_period_return" DECIMAL(65,30) NOT NULL,
ADD COLUMN     "net_annual_return" DECIMAL(65,30) NOT NULL,
ADD COLUMN     "net_monthly_return" DECIMAL(65,30) NOT NULL,
ADD COLUMN     "net_period_return" DECIMAL(65,30) NOT NULL;

-- CreateIndex
CREATE INDEX "simulation_result_net_annual_return_idx" ON "simulation_result"("net_annual_return");
