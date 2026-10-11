/*
  Warnings:

  - The primary key for the `processed_events` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `processed_events` table. All the data in the column will be lost.
  - Added the required column `consumer` to the `processed_events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `event_id` to the `processed_events` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "processed_events" DROP CONSTRAINT "processed_events_pkey",
DROP COLUMN "id",
ADD COLUMN     "consumer" TEXT NOT NULL,
ADD COLUMN     "event_id" UUID NOT NULL,
ADD CONSTRAINT "processed_events_pkey" PRIMARY KEY ("consumer", "event_id");
