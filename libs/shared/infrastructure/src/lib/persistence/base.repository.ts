import { AggregateRoot, Result } from '@investflow/shared-domain';
import { OutboxWriter } from '../messaging/outbox/outbox-writer';
import { RepositorySaveError } from './repository.error';
import type { TransactionalPrismaClient } from './prisma/prisma-client.type';
import { PrismaService } from './prisma/prisma.service';

export abstract class BaseRepository<T extends AggregateRoot> {
  private readonly outbox = new OutboxWriter();

  constructor(protected readonly prisma: PrismaService) {}

  async save(aggregate: T): Promise<Result<void, RepositorySaveError>> {
    return Result.fromPromise(
      async () => {
        // Preparing first rejects an invalid event before anything is written.
        const outboxRows = this.outbox.prepare(aggregate.getDomainEvents());
        const client = this.prisma.client;
        await this.persistAggregate(aggregate, client);
        await this.outbox.append(client, outboxRows);

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
