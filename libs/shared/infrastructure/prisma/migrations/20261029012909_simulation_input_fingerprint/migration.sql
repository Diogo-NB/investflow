/*
  Warnings:

  - You are about to drop the column `curve_values_revision` on the `simulation_calculation` table. All the data in the column will be lost.
  - You are about to drop the column `offer_terms_revision` on the `simulation_calculation` table. All the data in the column will be lost.
  - You are about to drop the column `curve_values_revision` on the `simulation_result` table. All the data in the column will be lost.
  - You are about to drop the column `methodology_version` on the `simulation_result` table. All the data in the column will be lost.
  - You are about to drop the column `offer_terms_revision` on the `simulation_result` table. All the data in the column will be lost.
  - You are about to drop the column `simulation_revision` on the `simulation_result` table. All the data in the column will be lost.
  - Added the required column `input_fingerprint` to the `simulation_result` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "simulation_calculation" DROP COLUMN "curve_values_revision",
DROP COLUMN "offer_terms_revision",
ADD COLUMN     "input_fingerprint" TEXT;

-- AlterTable
ALTER TABLE "simulation_result" DROP COLUMN "curve_values_revision",
DROP COLUMN "methodology_version",
DROP COLUMN "offer_terms_revision",
DROP COLUMN "simulation_revision",
ADD COLUMN     "input_fingerprint" TEXT NOT NULL;
