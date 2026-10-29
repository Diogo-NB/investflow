-- DropIndex
DROP INDEX "outbox_events_published_at_created_at_idx";

-- CreateIndex
CREATE INDEX "outbox_events_unpublished_created_at_idx" ON "outbox_events"("created_at") WHERE ("published_at" IS NULL);

-- CreateIndex
CREATE INDEX "outbox_events_published_at_idx" ON "outbox_events"("published_at") WHERE ("published_at" IS NOT NULL);
