import {
  AggregateRoot,
  AppError,
  DomainEventRecorder,
  Result,
} from '@investflow/shared-domain';
import { RepositorySaveError } from './repository.error';
import type { TransactionalPrismaClient } from './prisma/prisma-client.type';
import { PrismaService } from './prisma/prisma.service';

export abstract class BaseRepository<T extends AggregateRoot> {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly events: DomainEventRecorder,
  ) {}

  // An AppError thrown by persistAggregate (a revision conflict, an
  // unrepresentable value) is returned as is; anything else is a save failure.
  async save(
    aggregate: T,
  ): Promise<Result<void, AppError | RepositorySaveError>> {
    const persisted = await Result.fromPromise(
      () => this.persistAggregate(aggregate, this.prisma.client),
      (error) =>
        error instanceof AppError
          ? error
          : new RepositorySaveError(aggregate, error),
    );
    if (persisted.isErr()) return persisted;

    // Throws rather than returning an error: a change whose events cannot be
    // recorded must abort the whole unit of work, not commit without them.
    this.events.record(...aggregate.getDomainEvents());
    aggregate.markPersisted();
    return persisted;
  }

  protected abstract persistAggregate(
    aggregate: T,
    client: TransactionalPrismaClient,
  ): Promise<void>;
}
