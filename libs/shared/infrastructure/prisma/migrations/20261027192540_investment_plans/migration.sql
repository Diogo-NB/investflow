-- CreateTable
CREATE TABLE "investment_plan" (
    "id" UUID NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "revision" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "investment_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_plan_simulation" (
    "investment_plan_id" UUID NOT NULL,
    "simulation_id" UUID NOT NULL,

    CONSTRAINT "investment_plan_simulation_pkey" PRIMARY KEY ("investment_plan_id","simulation_id")
);

-- CreateIndex
CREATE INDEX "investment_plan_owner_id_idx" ON "investment_plan"("owner_id");

-- CreateIndex
CREATE INDEX "investment_plan_simulation_simulation_id_idx" ON "investment_plan_simulation"("simulation_id");

-- AddForeignKey
ALTER TABLE "investment_plan_simulation" ADD CONSTRAINT "investment_plan_simulation_investment_plan_id_fkey" FOREIGN KEY ("investment_plan_id") REFERENCES "investment_plan"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "investment_plan_simulation" ADD CONSTRAINT "investment_plan_simulation_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "simulation"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
