-- CreateEnum
CREATE TYPE "published_index" AS ENUM ('CDI', 'SELIC');

-- CreateTable
CREATE TABLE "published_index_series" (
    "id" UUID NOT NULL,
    "index" "published_index" NOT NULL,
    "year" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL,

    CONSTRAINT "published_index_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "published_index_value" (
    "series_id" UUID NOT NULL,
    "reference_date" DATE NOT NULL,
    "value" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "published_index_value_pkey" PRIMARY KEY ("series_id","reference_date")
);

-- CreateIndex
CREATE UNIQUE INDEX "published_index_series_index_year_key" ON "published_index_series"("index", "year");

-- AddForeignKey
ALTER TABLE "published_index_value" ADD CONSTRAINT "published_index_value_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "published_index_series"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
