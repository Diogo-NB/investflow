-- CreateTable
CREATE TABLE "offer_copy" (
    "offer_id" UUID NOT NULL,
    "title_type" "investment_title_type" NOT NULL,
    "maturity_date" DATE NOT NULL,
    "redemption_type" "investment_redemption_type" NOT NULL,
    "remuneration_type" "investment_remuneration_type" NOT NULL,
    "rate_value" DECIMAL(65,30) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL,
    "revision" INTEGER NOT NULL,
    "terms_revision" INTEGER NOT NULL,
    "last_event_id" UUID NOT NULL,

    CONSTRAINT "offer_copy_pkey" PRIMARY KEY ("offer_id")
);

-- CreateTable
CREATE TABLE "curve_copy" (
    "curve_id" UUID NOT NULL,
    "index" "economic_index" NOT NULL,
    "intervals" JSONB NOT NULL,
    "is_deleted" BOOLEAN NOT NULL,
    "revision" INTEGER NOT NULL,
    "values_revision" INTEGER NOT NULL,
    "last_event_id" UUID NOT NULL,

    CONSTRAINT "curve_copy_pkey" PRIMARY KEY ("curve_id")
);
