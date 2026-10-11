import {
  AggregateRoot,
  ConflictError,
  DomainEvent,
  EAppErrorCode,
  UtcInstant,
} from '@investflow/shared-domain';
import { RepositorySaveError } from './repository.error';
import { BaseRepository } from './base.repository';
import { PrismaService } from './prisma/prisma.service';
import type { TransactionalPrismaClient } from './prisma/prisma-client.type';

class TestEvent implements DomainEvent {
  readonly eventId = 'event-id';
  readonly occurredAt = UtcInstant.ofIso('2026-01-01T00:00:00Z');
  readonly eventType = 'TestEvent';
  readonly version = 1;
  readonly aggregateId = 'aggregate-id';
  readonly aggregateType = 'TestAggregate';
  readonly context = 'test-context';
}

class LargeTestEvent extends TestEvent {
  readonly notes = 'x'.repeat(200 * 1024);
}

class TestAggregate extends AggregateRoot {
  constructor() {
    super('aggregate-id');
  }

  recordEvent(event: DomainEvent = new TestEvent()): this {
    return this.apply(event);
  }
}

class TestRepository extends BaseRepository<TestAggregate> {
  readonly persistAggregateMock = jest.fn<Promise<void>, [TestAggregate]>();

  protected persistAggregate(
    aggregate: TestAggregate,
    _client: TransactionalPrismaClient,
  ): Promise<void> {
    return this.persistAggregateMock(aggregate);
  }
}

function createPrismaService() {
  return {
    client: {
      outboxEvent: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    },
  } as unknown as PrismaService;
}

describe('BaseRepository', () => {
  it('persists the aggregate and returns ok when there are no events', async () => {
    const prisma = createPrismaService();
    const repository = new TestRepository(prisma);
    const aggregate = new TestAggregate();

    const result = await repository.save(aggregate);

    expect(result.isOk()).toBe(true);
    expect(repository.persistAggregateMock).toHaveBeenCalledWith(aggregate);
    expect(prisma.client.outboxEvent.createMany).not.toHaveBeenCalled();
  });

  it('writes domain events to the outbox and clears them after save', async () => {
    const prisma = createPrismaService();
    const repository = new TestRepository(prisma);
    const aggregate = new TestAggregate().recordEvent();

    const result = await repository.save(aggregate);

    expect(result.isOk()).toBe(true);
    expect(prisma.client.outboxEvent.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ id: 'event-id', eventType: 'TestEvent' }),
      ],
    });
    expect(aggregate.getDomainEvents()).toEqual([]);
  });

  it('returns RepositorySaveError when persistence fails', async () => {
    const prisma = createPrismaService();
    const repository = new TestRepository(prisma);
    const aggregate = new TestAggregate().recordEvent();
    const cause = new Error('Database failed');
    repository.persistAggregateMock.mockRejectedValue(cause);

    const result = await repository.save(aggregate);

    expect(result.isErr()).toBe(true);
    expect(result.error).toBeInstanceOf(RepositorySaveError);
    expect(result.error.cause).toBe(cause);
    expect(result.error.metadata).toEqual({
      aggregateId: 'aggregate-id',
      aggregateType: 'TestAggregate',
    });
    expect(aggregate.getDomainEvents()).toHaveLength(1);
  });

  it('returns an application error thrown by persistence as is', async () => {
    const prisma = createPrismaService();
    const repository = new TestRepository(prisma);
    const aggregate = new TestAggregate().recordEvent();
    const conflict = new ConflictError('Conflito.', {
      code: EAppErrorCode.CURVE_REVISION_CONFLICT,
    });
    repository.persistAggregateMock.mockRejectedValue(conflict);

    const result = await repository.save(aggregate);

    expect(result.error).toBe(conflict);
    expect(prisma.client.outboxEvent.createMany).not.toHaveBeenCalled();
    expect(aggregate.getDomainEvents()).toHaveLength(1);
  });

  it('rejects an event above the outbox payload limit before persisting', async () => {
    const prisma = createPrismaService();
    const repository = new TestRepository(prisma);
    const aggregate = new TestAggregate().recordEvent(new LargeTestEvent());

    const result = await repository.save(aggregate);

    expect(result.isErr()).toBe(true);
    expect(result.error).toBeInstanceOf(RepositorySaveError);
    expect(repository.persistAggregateMock).not.toHaveBeenCalled();
    expect(prisma.client.outboxEvent.createMany).not.toHaveBeenCalled();
    expect(aggregate.getDomainEvents()).toHaveLength(1);
  });
});
