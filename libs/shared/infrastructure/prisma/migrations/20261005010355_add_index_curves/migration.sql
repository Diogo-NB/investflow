-- CreateEnum
CREATE TYPE "economic_index" AS ENUM ('CDI', 'SELIC', 'IPCA');

-- DropIndex
DROP INDEX "investment_offer_deleted_at_idx";

-- CreateTable
CREATE TABLE "index_curve" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "index" "economic_index" NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "index_curve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "index_curve_interval" (
    "curve_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "value" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "index_curve_interval_pkey" PRIMARY KEY ("curve_id","start_date")
);

-- AddForeignKey
ALTER TABLE "index_curve_interval" ADD CONSTRAINT "index_curve_interval_curve_id_fkey" FOREIGN KEY ("curve_id") REFERENCES "index_curve"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
