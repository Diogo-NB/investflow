/*
  Warnings:

  - The values [OFFER_CHANGED,OFFER_DELETED,CURVE_CHANGED,CURVE_DELETED] on the enum `simulation_calculation_cause_kind` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `cause_ref_id` on the `simulation_calculation` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "simulation_calculation_cause_kind_new" AS ENUM ('CREATED', 'SIMULATION_EDITED', 'METHODOLOGY_CHANGED', 'RETRY_REQUESTED');
ALTER TABLE "simulation_calculation" ALTER COLUMN "cause_kind" TYPE "simulation_calculation_cause_kind_new" USING ("cause_kind"::text::"simulation_calculation_cause_kind_new");
ALTER TYPE "simulation_calculation_cause_kind" RENAME TO "simulation_calculation_cause_kind_old";
ALTER TYPE "simulation_calculation_cause_kind_new" RENAME TO "simulation_calculation_cause_kind";
DROP TYPE "public"."simulation_calculation_cause_kind_old";
COMMIT;

-- AlterTable
ALTER TABLE "simulation_calculation" DROP COLUMN "cause_ref_id";
