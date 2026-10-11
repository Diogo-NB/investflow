/*
  Warnings:

  - You are about to drop the column `index_curve_id` on the `simulation_calculation` table. All the data in the column will be lost.
  - You are about to drop the `index_curve` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `index_curve_interval` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "index_curve_interval" DROP CONSTRAINT "index_curve_interval_curve_id_fkey";

-- DropForeignKey
ALTER TABLE "simulation_calculation" DROP CONSTRAINT "simulation_calculation_index_curve_id_fkey";

-- AlterTable
ALTER TABLE "simulation_calculation" DROP COLUMN "index_curve_id",
ADD COLUMN     "curve_id" UUID;

-- DropTable
DROP TABLE "index_curve";

-- DropTable
DROP TABLE "index_curve_interval";

-- CreateTable
CREATE TABLE "curve" (
    "id" UUID NOT NULL,
    "owner_id" TEXT,
    "index" "economic_index" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "revision" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "curve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curve_interval" (
    "curve_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "value" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "curve_interval_pkey" PRIMARY KEY ("curve_id","start_date")
);

-- CreateIndex
CREATE INDEX "curve_owner_id_idx" ON "curve"("owner_id");

-- AddForeignKey
ALTER TABLE "simulation_calculation" ADD CONSTRAINT "simulation_calculation_curve_id_fkey" FOREIGN KEY ("curve_id") REFERENCES "curve"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "curve_interval" ADD CONSTRAINT "curve_interval_curve_id_fkey" FOREIGN KEY ("curve_id") REFERENCES "curve"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
