-- DropForeignKey
ALTER TABLE "investment_offer" DROP CONSTRAINT "investment_offer_issuer_id_fkey";

-- DropForeignKey
ALTER TABLE "simulation" DROP CONSTRAINT "simulation_issuer_id_fkey";

-- DropIndex
DROP INDEX "investment_offer_issuer_id_idx";

-- AlterTable
ALTER TABLE "investment_offer" DROP COLUMN "issuer_id",
ADD COLUMN     "issuer_name" TEXT;

-- AlterTable
ALTER TABLE "simulation" DROP COLUMN "issuer_id",
ADD COLUMN     "issuer_name" TEXT;

-- DropTable
DROP TABLE "investment_issuer";
