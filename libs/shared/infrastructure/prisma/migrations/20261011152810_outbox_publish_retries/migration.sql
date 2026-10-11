-- AlterTable
ALTER TABLE "outbox_events" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_error" TEXT,
ADD COLUMN     "next_attempt_at" TIMESTAMP(3);
