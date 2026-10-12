import {
  AggregateRoot,
  ConflictError,
  DomainEvent,
  DomainEventRecorder,
  EAppErrorCode,
  Revision,
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

class TestAggregate extends AggregateRoot {
  constructor() {
    super('aggregate-id', Revision.restore(1));
  }

  change(): this {
    this.revisionTracker.increment();
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

function setup() {
  const record = jest.fn();
  const events = { record } as unknown as DomainEventRecorder;
  const repository = new TestRepository(
    { client: {} } as unknown as PrismaService,
    events,
  );
  return { repository, record };
}

describe('BaseRepository', () => {
  it('records the saved aggregate events and marks it persisted', async () => {
    const { repository, record } = setup();
    const aggregate = new TestAggregate().change();
    const [event] = aggregate.getDomainEvents();

    const result = await repository.save(aggregate);

    expect(result.isOk()).toBe(true);
    expect(repository.persistAggregateMock).toHaveBeenCalledWith(aggregate);
    expect(record).toHaveBeenCalledWith(event);
    expect(aggregate.getDomainEvents()).toEqual([]);
    expect(aggregate.change().revision).toBe(3);
  });

  it('returns RepositorySaveError and records nothing when persistence fails', async () => {
    const { repository, record } = setup();
    const aggregate = new TestAggregate().change();
    const cause = new Error('Database failed');
    repository.persistAggregateMock.mockRejectedValue(cause);

    const result = await repository.save(aggregate);

    expect(result.error).toBeInstanceOf(RepositorySaveError);
    expect(result.error.cause).toBe(cause);
    expect(result.error.metadata).toEqual({
      aggregateId: 'aggregate-id',
      aggregateType: 'TestAggregate',
    });
    expect(record).not.toHaveBeenCalled();
    expect(aggregate.getDomainEvents()).toHaveLength(1);
  });

  it('returns an application error thrown by persistence as is', async () => {
    const { repository, record } = setup();
    const aggregate = new TestAggregate().change();
    const conflict = new ConflictError('Conflito.', {
      code: EAppErrorCode.CURVE_REVISION_CONFLICT,
    });
    repository.persistAggregateMock.mockRejectedValue(conflict);

    const result = await repository.save(aggregate);

    expect(result.error).toBe(conflict);
    expect(record).not.toHaveBeenCalled();
  });

  it('throws when the events cannot be recorded, so the unit of work rolls back', async () => {
    const { repository, record } = setup();
    record.mockImplementation(() => {
      throw new Error('outside a unit of work');
    });
    const aggregate = new TestAggregate().change();

    await expect(repository.save(aggregate)).rejects.toThrow(
      'outside a unit of work',
    );
    expect(aggregate.getDomainEvents()).toHaveLength(1);
  });
});
