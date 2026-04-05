/*
  Warnings:

  - Added the required column `updated_at` to the `investment_products` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "investment_products" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;
