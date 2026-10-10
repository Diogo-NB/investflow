-- CreateTable
CREATE TABLE "simulation_run" (
    "id" UUID NOT NULL,
    "owner_id" TEXT NOT NULL,
    "application_id" UUID NOT NULL,
    "offer_snapshot_id" UUID NOT NULL,
    "index_curve_id" UUID,
    "principal" DECIMAL(65,30) NOT NULL,
    "investment_date" DATE NOT NULL,
    "methodology_version" TEXT NOT NULL,
    "calculated_at" TIMESTAMPTZ(3) NOT NULL,
    "gross_balance" DECIMAL(65,30) NOT NULL,
    "gross_earnings" DECIMAL(65,30) NOT NULL,
    "iof" DECIMAL(65,30) NOT NULL,
    "income_tax" DECIMAL(65,30) NOT NULL,
    "total_taxes" DECIMAL(65,30) NOT NULL,
    "net_balance" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "simulation_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_run_balance" (
    "run_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "gross_balance" DECIMAL(65,30) NOT NULL,
    "daily_gross_earnings" DECIMAL(65,30) NOT NULL,
    "accumulated_gross_earnings" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "simulation_run_balance_pkey" PRIMARY KEY ("run_id","date")
);

-- CreateIndex
CREATE INDEX "simulation_run_application_id_calculated_at_idx" ON "simulation_run"("application_id", "calculated_at" DESC);

-- AddForeignKey
ALTER TABLE "simulation_run" ADD CONSTRAINT "simulation_run_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "investment_application"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "simulation_run" ADD CONSTRAINT "simulation_run_offer_snapshot_id_fkey" FOREIGN KEY ("offer_snapshot_id") REFERENCES "investment_offer"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "simulation_run" ADD CONSTRAINT "simulation_run_index_curve_id_fkey" FOREIGN KEY ("index_curve_id") REFERENCES "index_curve"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "simulation_run_balance" ADD CONSTRAINT "simulation_run_balance_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "simulation_run"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
