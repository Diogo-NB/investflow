import { Logger } from '@nestjs/common';
import { Clock } from '@investflow/shared-application';
import {
  CalendarDate,
  DomainEvent,
  UtcInstant,
} from '@investflow/shared-domain';
import { OutboxRelay } from '../../messaging/outbox/outbox-relay';
import { TransactionalDomainEventRecorder } from '../../messaging/outbox/transactional-domain-event-recorder';
import { PrismaService } from '../prisma/prisma.service';
import { UnitOfWork } from '../unit-of-work';
import { UnitOfWorkContext } from '../unit-of-work.context';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

const event: DomainEvent = {
  eventId: 'event-id',
  occurredAt: UtcInstant.ofIso('2026-01-01T00:00:00Z'),
  eventType: 'TestEvent',
  version: 1,
  aggregateId: 'aggregate-id',
  aggregateType: 'TestAggregate',
  context: 'test-context',
};

const committedAt = UtcInstant.ofIso('2026-01-02T03:04:05Z');
const clock: Clock = {
  now: () => committedAt,
  today: () => CalendarDate.of('2026-01-02'),
};

function setup() {
  const createMany = jest.fn().mockResolvedValue({ count: 1 });
  const client = { outboxEvent: { createMany } };
  const state = { committed: false };
  const prisma = {
    $transaction: jest.fn(async (work: (tx: unknown) => Promise<unknown>) => {
      const result = await work(client);
      state.committed = true;
      return result;
    }),
  } as unknown as PrismaService;
  const enqueue = jest.fn();
  const relay = { enqueue } as unknown as OutboxRelay;
  return {
    unitOfWork: new UnitOfWork(prisma),
    recorder: new TransactionalDomainEventRecorder(clock, relay),
    client,
    createMany,
    enqueue,
    state,
  };
}

describe('UnitOfWork', () => {
  beforeEach(() => jest.spyOn(Logger.prototype, 'error').mockImplementation());
  afterEach(() => jest.restoreAllMocks());

  it('runs before-commit hooks in order inside the transaction', async () => {
    const { unitOfWork, client, state } = setup();
    const calls: string[] = [];

    const result = await unitOfWork.run(async () => {
      const scope = UnitOfWorkContext.current();
      expect(scope?.client).toBe(client);
      scope?.beforeCommit.push(async (tx) => {
        expect(tx).toBe(client);
        expect(state.committed).toBe(false);
        calls.push('first');
      });
      scope?.beforeCommit.push(async () => {
        calls.push('second');
      });
      return 'done';
    });

    expect(result).toBe('done');
    expect(calls).toEqual(['first', 'second']);
  });

  it('rolls back and skips after-commit hooks when a before-commit hook fails', async () => {
    const { unitOfWork, state } = setup();
    const afterCommit = jest.fn();

    await expect(
      unitOfWork.run(async () => {
        const scope = UnitOfWorkContext.current();
        scope?.beforeCommit.push(async () => {
          throw new Error('append failed');
        });
        scope?.afterCommit.push(afterCommit);
      }),
    ).rejects.toThrow('append failed');
    expect(state.committed).toBe(false);
    expect(afterCommit).not.toHaveBeenCalled();
  });

  it('runs after-commit hooks once committed, outside any unit of work', async () => {
    const { unitOfWork, state } = setup();
    const seen: { committed: boolean; scope: unknown }[] = [];

    await unitOfWork.run(async () => {
      UnitOfWorkContext.current()?.afterCommit.push(() =>
        seen.push({
          committed: state.committed,
          scope: UnitOfWorkContext.current(),
        }),
      );
    });

    expect(seen).toEqual([{ committed: true, scope: undefined }]);
  });

  it('keeps the result when an after-commit hook throws', async () => {
    const { unitOfWork } = setup();
    const next = jest.fn();

    const result = await unitOfWork.run(async () => {
      const scope = UnitOfWorkContext.current();
      scope?.afterCommit.push(() => {
        throw new Error('hook failed');
      });
      scope?.afterCommit.push(next);
      return 'done';
    });

    expect(result).toBe('done');
    expect(next).toHaveBeenCalled();
  });

  it('skips after-commit hooks when the work fails', async () => {
    const { unitOfWork } = setup();
    const afterCommit = jest.fn();

    await expect(
      unitOfWork.run(async () => {
        UnitOfWorkContext.current()?.afterCommit.push(afterCommit);
        throw new Error('work failed');
      }),
    ).rejects.toThrow('work failed');
    expect(afterCommit).not.toHaveBeenCalled();
  });

  it('registers an after-commit hook on the current unit of work', async () => {
    const { unitOfWork, state } = setup();
    const committed: boolean[] = [];

    await unitOfWork.run(async () => {
      unitOfWork.afterCommit(() => committed.push(state.committed));
    });

    expect(committed).toEqual([true]);
    expect(() => unitOfWork.afterCommit(jest.fn())).toThrow(
      'After-commit hooks need a unit of work to commit',
    );
  });

  it('has no current scope outside a unit of work', () => {
    expect(UnitOfWorkContext.current()).toBeUndefined();
  });
});

describe('TransactionalDomainEventRecorder', () => {
  it('writes the recorded events before commit, stamped with the clock', async () => {
    const { unitOfWork, recorder, createMany } = setup();

    await unitOfWork.run(async () => {
      recorder.record(event);
      recorder.record({ ...event, eventId: 'event-id-2' });
      expect(createMany).not.toHaveBeenCalled();
    });

    expect(createMany).toHaveBeenCalledTimes(1);
    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          id: 'event-id',
          createdAt: committedAt.date,
        }),
        expect.objectContaining({
          id: 'event-id-2',
          createdAt: committedAt.date,
        }),
      ],
    });
  });

  it('hands every row of the unit of work to the relay once committed', async () => {
    const { unitOfWork, recorder, enqueue, state } = setup();
    enqueue.mockImplementation(() => expect(state.committed).toBe(true));

    await unitOfWork.run(async () => {
      recorder.record(event);
      recorder.record({ ...event, eventId: 'event-id-2' });
    });

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(
      enqueue.mock.calls[0][0].map((row: { id: string }) => row.id),
    ).toEqual(['event-id', 'event-id-2']);
  });

  it('writes nothing and relays nothing when the work fails', async () => {
    const { unitOfWork, recorder, createMany, enqueue } = setup();

    await expect(
      unitOfWork.run(async () => {
        recorder.record(event);
        throw new Error('work failed');
      }),
    ).rejects.toThrow('work failed');
    expect(createMany).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('only writes the events when the host has no relay', async () => {
    const { unitOfWork, createMany } = setup();
    const recorder = new TransactionalDomainEventRecorder(clock);

    await unitOfWork.run(async () => recorder.record(event));

    expect(createMany).toHaveBeenCalledTimes(1);
  });

  it('refuses to record outside a unit of work', () => {
    expect(() =>
      new TransactionalDomainEventRecorder(clock).record(event),
    ).toThrow(/outside a unit of work would be lost: TestEvent/);
  });

  it('rejects an event the outbox would refuse when it is recorded', async () => {
    const { unitOfWork, recorder } = setup();
    const large = { ...event, notes: 'x'.repeat(200 * 1024) };

    await expect(
      unitOfWork.run(async () => recorder.record(large)),
    ).rejects.toThrow(/above the 204800-byte outbox limit/);
  });
});
