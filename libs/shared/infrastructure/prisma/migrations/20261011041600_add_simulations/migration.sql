-- AlterTable
ALTER TABLE "investment_offer" ALTER COLUMN "issuer_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "simulation" (
    "id" UUID NOT NULL,
    "owner_id" TEXT NOT NULL,
    "source_offer_id" UUID,
    "title_type" "investment_title_type" NOT NULL,
    "issuer_id" UUID,
    "maturity_date" DATE NOT NULL,
    "redemption_type" "investment_redemption_type" NOT NULL,
    "remuneration_type" "investment_remuneration_type" NOT NULL,
    "rate_value" DECIMAL(65,30) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "simulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_calculation" (
    "id" UUID NOT NULL,
    "simulation_id" UUID NOT NULL,
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
    "holding_period_calendar_days" INTEGER NOT NULL,
    "taxable_earnings" DECIMAL(65,30) NOT NULL,
    "income_tax_base" DECIMAL(65,30) NOT NULL,
    "iof_rate" DECIMAL(65,30),
    "income_tax_rate" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "simulation_calculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_calculation_balance" (
    "calculation_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "gross_balance" DECIMAL(65,30) NOT NULL,
    "daily_gross_earnings" DECIMAL(65,30) NOT NULL,
    "accumulated_gross_earnings" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "simulation_calculation_balance_pkey" PRIMARY KEY ("calculation_id","date")
);

-- CreateIndex
CREATE INDEX "simulation_owner_id_idx" ON "simulation"("owner_id");

-- CreateIndex
CREATE INDEX "simulation_calculation_simulation_id_calculated_at_idx" ON "simulation_calculation"("simulation_id", "calculated_at" DESC);

-- AddForeignKey
ALTER TABLE "simulation" ADD CONSTRAINT "simulation_source_offer_id_fkey" FOREIGN KEY ("source_offer_id") REFERENCES "investment_offer"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "simulation" ADD CONSTRAINT "simulation_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "investment_issuer"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "simulation_calculation" ADD CONSTRAINT "simulation_calculation_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "simulation"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "simulation_calculation" ADD CONSTRAINT "simulation_calculation_index_curve_id_fkey" FOREIGN KEY ("index_curve_id") REFERENCES "index_curve"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "simulation_calculation_balance" ADD CONSTRAINT "simulation_calculation_balance_calculation_id_fkey" FOREIGN KEY ("calculation_id") REFERENCES "simulation_calculation"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
