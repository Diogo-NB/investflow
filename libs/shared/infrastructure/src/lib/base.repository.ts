import { AggregateRoot, DomainEvent, Result } from '@investflow/shared-domain';
import type { Prisma } from '@prisma/client';
import { RepositorySaveError } from './errors/repository.error';
import type { TransactionalPrismaClient } from './prisma/prisma-client.type';
import { PrismaService } from './prisma/prisma.service';

export abstract class BaseRepository<T extends AggregateRoot> {
  constructor(protected readonly prisma: PrismaService) {}

  async save(aggregate: T): Promise<Result<void, RepositorySaveError>> {
    return Result.fromPromise(
      async () => {
        const client = this.prisma.client;
        await this.persistAggregate(aggregate, client);

        const events = aggregate.getDomainEvents();
        if (events.length === 0) return;

        await client.outboxEvent.createMany({
          data: events.map((event) => ({
            id: event.eventId,
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            eventType: event.eventType,
            payload: serializeDomainEvent(event),
            context: event.context,
            occurredAt: event.occurredAt.date,
          })),
        });

        aggregate.clearDomainEvents();
      },
      (error) => new RepositorySaveError(aggregate, error),
    );
  }

  protected abstract persistAggregate(
    aggregate: T,
    client: TransactionalPrismaClient,
  ): Promise<void>;
}

function serializeDomainEvent(event: DomainEvent): Prisma.InputJsonObject {
  return {
    ...event,
    occurredAt: event.occurredAt.toISOString(),
  };
}
