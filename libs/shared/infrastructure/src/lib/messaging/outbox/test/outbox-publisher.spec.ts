import { Logger } from '@nestjs/common';
import { Clock } from '@investflow/shared-application';
import { CalendarDate, UtcInstant } from '@investflow/shared-domain';
import type { TransactionalPrismaClient } from '../../../persistence/prisma/prisma-client.type';
import { MessageBroker, RejectedMessage } from '../message-broker.port';
import { OutboxEntry, OutboxPublisher } from '../outbox-publisher';

const startedAt = UtcInstant.ofIso('2026-01-02T03:04:05Z');

function entry(id: string, attempts = 0, payload = '{}'): OutboxEntry {
  return {
    message: {
      eventId: id,
      eventType: 'TestHappened',
      context: 'test',
      payload,
    },
    attempts,
  };
}

function entries(count: number): OutboxEntry[] {
  return Array.from({ length: count }, (_, index) => entry(`event-${index}`));
}

function createFixture() {
  let now = startedAt;
  const clock: Clock = {
    now: () => now,
    today: () => CalendarDate.of('2026-01-02'),
  };
  const publish = jest
    .fn<
      Promise<readonly RejectedMessage[]>,
      [readonly { eventId: string }[], AbortSignal]
    >()
    .mockResolvedValue([]);
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  return {
    publisher: new OutboxPublisher(
      { publish } as unknown as MessageBroker,
      clock,
    ),
    publish,
    updateMany,
    client: {
      outboxEvent: { updateMany },
    } as unknown as TransactionalPrismaClient,
    advance: (milliseconds: number) => {
      now = now.addMs(milliseconds);
    },
  };
}

function deferred() {
  let resolve!: (value: readonly RejectedMessage[]) => void;
  const promise = new Promise<readonly RejectedMessage[]>((r) => (resolve = r));
  return { promise, resolve };
}

describe('OutboxPublisher', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  describe('batchLength', () => {
    it('takes at most 10 entries', () => {
      expect(OutboxPublisher.batchLength(entries(25))).toBe(10);
      expect(OutboxPublisher.batchLength(entries(25), 20)).toBe(5);
    });

    it('stops before the batch would exceed its byte limit', () => {
      const large = 'x'.repeat(100 * 1024);
      const batch = [
        entry('a', 0, large),
        entry('b', 0, large),
        entry('c', 0, large),
      ];

      expect(OutboxPublisher.batchLength(batch)).toBe(2);
      expect(OutboxPublisher.batchLength(batch, 2)).toBe(1);
    });
  });

  it('publishes in batches of 10 with a timeout signal and reports what was published', async () => {
    const { publisher, publish } = createFixture();

    const outcome = await publisher.publish(entries(25));

    expect(publish.mock.calls.map(([messages]) => messages.length)).toEqual([
      10, 10, 5,
    ]);
    expect(publish.mock.calls[0][1]).toBeInstanceOf(AbortSignal);
    expect(outcome.published).toHaveLength(25);
    expect(outcome.failed).toEqual([]);
  });

  it('fails only the messages the broker rejected', async () => {
    const { publisher, publish } = createFixture();
    publish.mockResolvedValueOnce([
      { eventId: 'event-1', reason: 'too large' },
    ]);

    const outcome = await publisher.publish(entries(3));

    expect(outcome.published).toEqual(['event-0', 'event-2']);
    expect(outcome.failed).toEqual([
      { entry: expect.objectContaining({ attempts: 0 }), reason: 'too large' },
    ]);
  });

  it('fails every message of a batch whose call failed', async () => {
    const { publisher, publish } = createFixture();
    publish.mockRejectedValueOnce(new Error('broker down'));

    const outcome = await publisher.publish(entries(12));

    expect(outcome.published).toHaveLength(2);
    expect(outcome.failed).toHaveLength(10);
    expect(outcome.failed[0].reason).toBe('broker down');
  });

  it('never has more than 8 requests in flight', async () => {
    const { publisher, publish } = createFixture();
    const calls = Array.from({ length: 10 }, deferred);
    calls.forEach((call) => publish.mockReturnValueOnce(call.promise));

    const outcome = publisher.publish(entries(100));
    await Promise.resolve();

    expect(publish).toHaveBeenCalledTimes(8);
    expect(publisher.hasCapacity()).toBe(false);

    calls[0].resolve([]);
    await new Promise((resolve) => setImmediate(resolve));
    expect(publish).toHaveBeenCalledTimes(9);

    calls.forEach((call) => call.resolve([]));
    expect((await outcome).published).toHaveLength(100);
    expect(publisher.hasCapacity()).toBe(true);
  });

  it('marks published rows in one update with the clock time', async () => {
    const { publisher, client, updateMany } = createFixture();

    await publisher.markPublished(client, ['event-1', 'event-2']);
    await publisher.markPublished(client, []);

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['event-1', 'event-2'] } },
      data: { publishedAt: startedAt.date },
    });
  });

  it('backs failed rows off exponentially, grouped by attempt and reason', async () => {
    const { publisher, client, updateMany } = createFixture();

    await publisher.recordFailures(client, [
      { entry: entry('event-1', 2), reason: 'payload rejected' },
      { entry: entry('event-2', 2), reason: 'payload rejected' },
      { entry: entry('event-3', 20), reason: 'payload rejected' },
    ]);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['event-1', 'event-2'] } },
      data: {
        attempts: 3,
        nextAttemptAt: new Date(startedAt.epochMilliseconds + 4_000),
        lastError: 'payload rejected',
      },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['event-3'] } },
      data: {
        attempts: 21,
        nextAttemptAt: new Date(startedAt.epochMilliseconds + 5 * 60_000),
        lastError: 'payload rejected',
      },
    });
  });

  it('pauses after 3 consecutive failed requests and skips batches while paused', async () => {
    const { publisher, publish, advance } = createFixture();
    publish.mockRejectedValue(new Error('broker down'));

    for (let request = 0; request < 3; request++) {
      await publisher.publish(entries(1));
    }
    expect(publisher.isPaused()).toBe(true);
    expect(publisher.hasCapacity()).toBe(false);

    const skipped = await publisher.publish(entries(5));
    expect(skipped).toEqual({ published: [], failed: [] });
    expect(publish).toHaveBeenCalledTimes(3);

    advance(1_000);
    expect(publisher.isPaused()).toBe(false);
  });

  it('doubles the pause while requests keep failing and resets it after a success', async () => {
    const { publisher, publish, advance } = createFixture();
    publish.mockRejectedValue(new Error('broker down'));
    for (let request = 0; request < 3; request++) {
      await publisher.publish(entries(1));
    }

    advance(1_000);
    await publisher.publish(entries(1));
    advance(1_999);
    expect(publisher.isPaused()).toBe(true);
    advance(1);
    expect(publisher.isPaused()).toBe(false);

    publish.mockResolvedValue([]);
    await publisher.publish(entries(1));
    publish.mockRejectedValue(new Error('broker down'));
    await publisher.publish(entries(1));
    await publisher.publish(entries(1));
    expect(publisher.isPaused()).toBe(false);
    await publisher.publish(entries(1));
    expect(publisher.isPaused()).toBe(true);
    advance(1_000);
    expect(publisher.isPaused()).toBe(false);
  });
});
