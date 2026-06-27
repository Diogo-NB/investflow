import { AggregateRoot, DomainEvent } from '@investflow/shared-domain';
import { RepositorySaveError } from './errors/repository.error';
import { BaseRepository } from './base.repository';
import { PrismaService } from './prisma/prisma.service';
import type { TransactionalPrismaClient } from './prisma/prisma-client.type';

class TestEvent implements DomainEvent {
  readonly eventId = 'event-id';
  readonly occurredAt = new Date('2026-01-01T00:00:00.000Z');
  readonly eventType = 'TestEvent';
  readonly version = 1;
  readonly aggregateId = 'aggregate-id';
  readonly aggregateType = 'TestAggregate';
  readonly context = 'test-context';
}

class TestAggregate extends AggregateRoot {
  constructor() {
    const now = new Date('2026-01-01T00:00:00.000Z');
    super('aggregate-id', now, now);
  }

  recordEvent(): this {
    return this.apply(new TestEvent());
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
        expect.objectContaining({
          id: 'event-id',
          aggregateId: 'aggregate-id',
          aggregateType: 'TestAggregate',
          eventType: 'TestEvent',
          context: 'test-context',
        }),
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
});
