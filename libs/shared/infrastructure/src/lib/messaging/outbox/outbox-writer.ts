import { DomainEvent } from '@investflow/shared-domain';
import type { Prisma } from '@prisma/client';
import type { TransactionalPrismaClient } from '../../persistence/prisma/prisma-client.type';

// Events are notifications carrying identifiers and changed fields, not
// documents. Every broker adapter must accept payloads up to this size, so an
// oversized event fails its use case instead of committing and never publishing.
const MAX_OUTBOX_PAYLOAD_BYTES = 200 * 1024;

export type OutboxRows = readonly Prisma.OutboxEventCreateManyInput[];

export class OutboxWriter {
  prepare(events: readonly DomainEvent[]): OutboxRows {
    return events.map((event) => {
      const payload = serialize(event);
      const bytes = Buffer.byteLength(JSON.stringify(payload));
      if (bytes > MAX_OUTBOX_PAYLOAD_BYTES) {
        throw new Error(
          `Event ${event.eventType} ${event.eventId} has ${bytes} bytes, above the ${MAX_OUTBOX_PAYLOAD_BYTES}-byte outbox limit`,
        );
      }

      return {
        id: event.eventId,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        payload,
        context: event.context,
        occurredAt: event.occurredAt.date,
      };
    });
  }

  async append(
    client: TransactionalPrismaClient,
    rows: OutboxRows,
  ): Promise<void> {
    if (rows.length === 0) return;
    await client.outboxEvent.createMany({ data: [...rows] });
  }
}

function serialize(event: DomainEvent): Prisma.InputJsonObject {
  return { ...event, occurredAt: event.occurredAt.toISOString() };
}
