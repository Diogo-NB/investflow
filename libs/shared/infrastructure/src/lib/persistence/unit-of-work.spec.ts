import { DomainEvent, UtcInstant } from '@investflow/shared-domain';
import { TransactionalDomainEventRecorder } from '../messaging/outbox/transactional-domain-event-recorder';
import { PrismaService } from './prisma/prisma.service';
import { UnitOfWork } from './unit-of-work';
import { UnitOfWorkContext } from './unit-of-work.context';

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

function setup() {
  const createMany = jest.fn().mockResolvedValue({ count: 1 });
  const client = { outboxEvent: { createMany } };
  const prisma = {
    $transaction: jest.fn((work: (tx: unknown) => Promise<unknown>) =>
      work(client),
    ),
  } as unknown as PrismaService;
  return {
    unitOfWork: new UnitOfWork(prisma),
    recorder: new TransactionalDomainEventRecorder(),
    client,
    createMany,
  };
}

describe('UnitOfWork', () => {
  it('writes the recorded events to the outbox before the transaction ends', async () => {
    const { unitOfWork, recorder, client, createMany } = setup();

    const result = await unitOfWork.run(async () => {
      expect(UnitOfWorkContext.current()?.client).toBe(client);
      recorder.record(event);
      expect(createMany).not.toHaveBeenCalled();
      return 'done';
    });

    expect(result).toBe('done');
    expect(createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ id: 'event-id' })],
    });
  });

  it('writes nothing when the work fails, so the transaction rolls back', async () => {
    const { unitOfWork, recorder, createMany } = setup();

    await expect(
      unitOfWork.run(async () => {
        recorder.record(event);
        throw new Error('work failed');
      }),
    ).rejects.toThrow('work failed');
    expect(createMany).not.toHaveBeenCalled();
  });

  it('has no current scope outside a unit of work', () => {
    expect(UnitOfWorkContext.current()).toBeUndefined();
  });
});

describe('TransactionalDomainEventRecorder', () => {
  it('refuses to record outside a unit of work', () => {
    expect(() => new TransactionalDomainEventRecorder().record(event)).toThrow(
      /outside a unit of work would be lost: TestEvent/,
    );
  });

  it('rejects an event the outbox would refuse when it is recorded', async () => {
    const { unitOfWork, recorder } = setup();
    const large = { ...event, notes: 'x'.repeat(200 * 1024) };

    await expect(
      unitOfWork.run(async () => recorder.record(large)),
    ).rejects.toThrow(/above the 204800-byte outbox limit/);
  });
});
