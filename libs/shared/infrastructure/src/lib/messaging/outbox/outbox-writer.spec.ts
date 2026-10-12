import { DomainEvent, UtcInstant } from '@investflow/shared-domain';
import type { TransactionalPrismaClient } from '../../persistence/prisma/prisma-client.type';
import { OutboxWriter } from './outbox-writer';

const event: DomainEvent = {
  eventId: 'event-id',
  occurredAt: UtcInstant.ofIso('2026-01-01T00:00:00Z'),
  eventType: 'TestEvent',
  version: 1,
  aggregateId: 'aggregate-id',
  aggregateType: 'TestAggregate',
  context: 'test-context',
};

describe('OutboxWriter', () => {
  const writer = new OutboxWriter();

  it('maps an event to an outbox row with a serializable payload', () => {
    expect(writer.prepare([event])).toEqual([
      {
        id: 'event-id',
        aggregateType: 'TestAggregate',
        aggregateId: 'aggregate-id',
        eventType: 'TestEvent',
        context: 'test-context',
        occurredAt: new Date('2026-01-01T00:00:00.000Z'),
        payload: {
          eventId: 'event-id',
          occurredAt: '2026-01-01T00:00:00.000Z',
          eventType: 'TestEvent',
          version: 1,
          aggregateId: 'aggregate-id',
          aggregateType: 'TestAggregate',
          context: 'test-context',
        },
      },
    ]);
  });

  it('rejects an event above the outbox payload limit', () => {
    const large = { ...event, notes: 'x'.repeat(200 * 1024) };

    expect(() => writer.prepare([large])).toThrow(
      /Event TestEvent event-id has \d+ bytes, above the 204800-byte outbox limit/,
    );
  });

  it('writes rows in chunks of 1,000 and skips the write when there are none', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const client = {
      outboxEvent: { createMany },
    } as unknown as TransactionalPrismaClient;
    const rows = Array.from({ length: 2_500 }, (_, index) => ({
      ...writer.prepare([event])[0],
      id: `event-${index}`,
    }));

    await writer.append(client, rows);
    await writer.append(client, []);

    expect(createMany.mock.calls.map(([{ data }]) => data.length)).toEqual([
      1_000, 1_000, 500,
    ]);
    expect(createMany.mock.calls[2][0].data.at(-1).id).toBe('event-2499');
  });
});
