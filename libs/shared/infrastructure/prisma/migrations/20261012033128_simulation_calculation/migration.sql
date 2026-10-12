-- CreateEnum
CREATE TYPE "simulation_calculation_status" AS ENUM ('PENDING', 'CALCULATED', 'INVALID', 'FAILED');

-- CreateEnum
CREATE TYPE "simulation_calculation_cause_kind" AS ENUM ('CREATED', 'SIMULATION_EDITED', 'OFFER_CHANGED', 'OFFER_DELETED', 'CURVE_CHANGED', 'CURVE_DELETED', 'METHODOLOGY_CHANGED', 'RETRY_REQUESTED');

-- CreateTable
CREATE TABLE "simulation_calculation" (
    "simulation_id" UUID NOT NULL,
    "status" "simulation_calculation_status" NOT NULL,
    "changed_at" TIMESTAMPTZ(3) NOT NULL,
    "cause_kind" "simulation_calculation_cause_kind" NOT NULL,
    "cause_ref_id" UUID,
    "cause_actor_id" TEXT,
    "simulation_revision" INTEGER NOT NULL,
    "offer_revision" INTEGER,
    "curve_revision" INTEGER,
    "reason_code" TEXT,
    "reason_metadata" JSONB,

    CONSTRAINT "simulation_calculation_pkey" PRIMARY KEY ("simulation_id")
);

-- AddForeignKey
ALTER TABLE "simulation_calculation" ADD CONSTRAINT "simulation_calculation_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "simulation"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
