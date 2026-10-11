import { Clock } from '@investflow/shared-application';
import { CalendarDate, UtcInstant } from '@investflow/shared-domain';
import { MessageBroker } from './message-broker.port';
import { OutboxPollerService } from './outbox-poller.service';
import { PrismaService } from '../../persistence/prisma/prisma.service';

const startedAt = UtcInstant.ofIso('2026-01-02T03:04:05Z');

function outboxRow(id: string, attempts = 0) {
  return {
    id,
    eventType: 'TestHappened',
    context: 'test-context',
    payload: { eventId: id, eventType: 'TestHappened' },
    attempts,
  };
}

function createFixture(rows: ReturnType<typeof outboxRow>[]) {
  let now = startedAt;
  const update = jest.fn().mockResolvedValue(undefined);
  const findMany = jest.fn().mockResolvedValue(rows);
  const prisma = {
    client: { outboxEvent: { findMany, update } },
  } as unknown as PrismaService;
  const publish = jest.fn().mockResolvedValue(undefined);
  const messageBroker = { publish } as unknown as MessageBroker;
  const clock: Clock = {
    now: () => now,
    today: () => CalendarDate.of('2026-01-02'),
  };

  return {
    poller: new OutboxPollerService(prisma, messageBroker, clock),
    findMany,
    update,
    publish,
    advance: (milliseconds: number) => {
      now = now.addMs(milliseconds);
    },
  };
}

function failuresRecorded(update: jest.Mock) {
  return update.mock.calls.filter(([args]) => 'attempts' in args.data);
}

describe('OutboxPollerService', () => {
  it('fetches only unpublished events that are due', async () => {
    const { poller, findMany } = createFixture([]);

    await poller.poll();

    expect(findMany).toHaveBeenCalledWith({
      where: {
        publishedAt: null,
        OR: [
          { nextAttemptAt: null },
          { nextAttemptAt: { lte: startedAt.date } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  });

  it('publishes an event and then marks it published with the clock time', async () => {
    const row = outboxRow('event-1');
    const { poller, publish, update } = createFixture([row]);

    await poller.poll();

    expect(publish).toHaveBeenCalledWith({
      eventId: 'event-1',
      eventType: 'TestHappened',
      context: 'test-context',
      payload: JSON.stringify(row.payload),
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: { publishedAt: startedAt.date },
    });
    expect(publish.mock.invocationCallOrder[0]).toBeLessThan(
      update.mock.invocationCallOrder[0],
    );
  });

  it('backs a failed event off without stopping the rest', async () => {
    const { poller, publish, update } = createFixture([
      outboxRow('event-1', 2),
      outboxRow('event-2'),
    ]);
    publish.mockRejectedValueOnce(new Error('payload rejected'));

    await poller.poll();

    expect(update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: {
        attempts: 3,
        nextAttemptAt: new Date(startedAt.epochMilliseconds + 4_000),
        lastError: 'payload rejected',
      },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'event-2' },
      data: { publishedAt: startedAt.date },
    });
  });

  it('caps the retry delay at five minutes', async () => {
    const { poller, publish, update } = createFixture([
      outboxRow('event-1', 20),
    ]);
    publish.mockRejectedValueOnce(new Error('payload rejected'));

    await poller.poll();

    expect(failuresRecorded(update)[0][0].data.nextAttemptAt).toEqual(
      new Date(startedAt.epochMilliseconds + 5 * 60_000),
    );
  });

  it('pauses after consecutive failures of different events', async () => {
    const rows = ['event-1', 'event-2', 'event-3', 'event-4'].map((id) =>
      outboxRow(id),
    );
    const { poller, publish, update, findMany, advance } = createFixture(rows);
    publish.mockRejectedValue(new Error('broker down'));

    await poller.poll();

    expect(publish).toHaveBeenCalledTimes(3);
    expect(failuresRecorded(update)).toHaveLength(3);

    advance(999);
    await poller.poll();
    expect(findMany).toHaveBeenCalledTimes(1);

    advance(1);
    await poller.poll();
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it('doubles the pause while the broker keeps failing and resets it after a success', async () => {
    const rows = ['event-1', 'event-2', 'event-3'].map((id) => outboxRow(id));
    const { poller, publish, findMany, advance } = createFixture(rows);
    publish.mockRejectedValue(new Error('broker down'));

    await poller.poll();
    advance(1_000);
    await poller.poll();
    advance(1_999);
    await poller.poll();
    expect(findMany).toHaveBeenCalledTimes(2);

    advance(1);
    publish.mockResolvedValue(undefined);
    await poller.poll();
    publish.mockRejectedValue(new Error('broker down'));
    await poller.poll();
    advance(1_000);
    await poller.poll();
    expect(findMany).toHaveBeenCalledTimes(5);
  });

  it('skips a poll while the previous one is still running', async () => {
    const { poller, findMany } = createFixture([]);
    let release!: (rows: unknown[]) => void;
    findMany.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));

    const first = poller.poll();
    await poller.poll();
    release([]);
    await first;

    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
