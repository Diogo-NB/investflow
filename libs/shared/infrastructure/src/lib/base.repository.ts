import { AggregateRoot } from '@investflow/shared-domain';
import type { Prisma } from '@prisma/client';
import type { TransactionalPrismaClient } from './prisma/prisma-client.type';
import { PrismaService } from './prisma/prisma.service';

export abstract class BaseRepository<T extends AggregateRoot> {
  constructor(protected readonly prisma: PrismaService) {}

  async save(aggregate: T): Promise<void> {
    const client = this.prisma.client;
    await this.persistAggregate(aggregate, client);

    const events = aggregate.getDomainEvents();
    if (events.length === 0) return;

    await client.outboxEvent.createMany({
      data: events.map((event) => ({
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payload: event as unknown as Prisma.InputJsonValue,
        context: event.context,
        occurredAt: event.occurredAt,
      })),
    });

    aggregate.clearDomainEvents();
  }

  protected abstract persistAggregate(
    aggregate: T,
    client: TransactionalPrismaClient,
  ): Promise<void>;
}
