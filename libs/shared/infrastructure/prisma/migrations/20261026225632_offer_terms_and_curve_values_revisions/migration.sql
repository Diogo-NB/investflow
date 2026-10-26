/*
  Warnings:

  - You are about to drop the column `curve_revision` on the `simulation_calculation` table. All the data in the column will be lost.
  - You are about to drop the column `offer_revision` on the `simulation_calculation` table. All the data in the column will be lost.
  - You are about to drop the column `curve_revision` on the `simulation_result` table. All the data in the column will be lost.
  - You are about to drop the column `offer_revision` on the `simulation_result` table. All the data in the column will be lost.
  - Added the required column `values_revision` to the `curve` table without a default value. This is not possible if the table is not empty.
  - Added the required column `terms_revision` to the `offer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `offer_terms_revision` to the `simulation_result` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "curve" ADD COLUMN     "values_revision" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "offer" ADD COLUMN     "terms_revision" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "simulation_calculation" DROP COLUMN "curve_revision",
DROP COLUMN "offer_revision",
ADD COLUMN     "curve_values_revision" INTEGER,
ADD COLUMN     "offer_terms_revision" INTEGER;

-- AlterTable
ALTER TABLE "simulation_result" DROP COLUMN "curve_revision",
DROP COLUMN "offer_revision",
ADD COLUMN     "curve_values_revision" INTEGER,
ADD COLUMN     "offer_terms_revision" INTEGER NOT NULL;
