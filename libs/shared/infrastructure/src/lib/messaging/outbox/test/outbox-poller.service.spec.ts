import { Logger } from '@nestjs/common';
import { Clock } from '@investflow/shared-application';
import { CalendarDate, UtcInstant } from '@investflow/shared-domain';
import { PrismaService } from '../../../persistence/prisma/prisma.service';
import { OutboxPollerService } from '../outbox-poller.service';
import { OutboxPublisher } from '../outbox-publisher';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

const startedAt = UtcInstant.ofIso('2026-01-02T03:04:05Z');

function claimedRow(id: string, attempts = 0) {
  return {
    id,
    eventType: 'TestHappened',
    context: 'test-context',
    payload: { eventId: id },
    attempts,
  };
}

function createFixture(rows: ReturnType<typeof claimedRow>[]) {
  const queryRaw = jest.fn().mockResolvedValue(rows);
  const client = { $queryRaw: queryRaw };
  const prisma = {
    $transaction: jest.fn((work: (tx: unknown) => Promise<unknown>) =>
      work(client),
    ),
  } as unknown as PrismaService;
  const publisher = {
    isPaused: jest.fn().mockReturnValue(false),
    publish: jest.fn().mockResolvedValue({ published: [], failed: [] }),
    markPublished: jest.fn().mockResolvedValue(undefined),
    recordFailures: jest.fn().mockResolvedValue(undefined),
  };
  const clock: Clock = {
    now: () => startedAt,
    today: () => CalendarDate.of('2026-01-02'),
  };
  return {
    poller: new OutboxPollerService(
      prisma,
      publisher as unknown as OutboxPublisher,
      clock,
    ),
    client,
    queryRaw,
    publisher,
  };
}

describe('OutboxPollerService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('claims due rows and rows past the grace period without waiting for locked ones', async () => {
    const { poller, queryRaw } = createFixture([]);

    await poller.drainOnce();

    const [strings, ...values] = queryRaw.mock.calls[0];
    const sql = strings.join('?').replace(/\s+/g, ' ');
    expect(sql).toContain('WHERE published_at IS NULL');
    expect(sql).toContain('next_attempt_at <= ?');
    expect(sql).toContain('next_attempt_at IS NULL AND created_at < ?');
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(values).toEqual([
      startedAt.date,
      new Date(startedAt.epochMilliseconds - 5_000),
      100,
    ]);
  });

  it('publishes the claimed rows and records the outcome through the claiming transaction', async () => {
    const { poller, client, publisher } = createFixture([
      claimedRow('event-1'),
      claimedRow('event-2', 3),
    ]);
    const failed = [{ entry: {}, reason: 'too large' }];
    publisher.publish.mockResolvedValue({ published: ['event-1'], failed });

    const claimed = await poller.drainOnce();

    expect(claimed).toBe(2);
    expect(publisher.publish).toHaveBeenCalledWith([
      {
        message: {
          eventId: 'event-1',
          eventType: 'TestHappened',
          context: 'test-context',
          payload: '{"eventId":"event-1"}',
        },
        attempts: 0,
      },
      expect.objectContaining({ attempts: 3 }),
    ]);
    expect(publisher.markPublished).toHaveBeenCalledWith(client, ['event-1']);
    expect(publisher.recordFailures).toHaveBeenCalledWith(client, failed);
  });

  it('claims nothing while publishing is paused', async () => {
    const { poller, queryRaw, publisher } = createFixture([
      claimedRow('event-1'),
    ]);
    publisher.isPaused.mockReturnValue(true);

    expect(await poller.drainOnce()).toBe(0);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('drains again at once while batches come back full, and stops on shutdown', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { poller } = createFixture([]);
    const drainOnce = jest
      .spyOn(poller, 'drainOnce')
      .mockResolvedValueOnce(100)
      .mockRejectedValueOnce(new Error('database down'))
      .mockResolvedValue(0);

    poller.onApplicationBootstrap();
    await new Promise((resolve) => setImmediate(resolve));
    expect(drainOnce).toHaveBeenCalledTimes(2);

    await poller.onModuleDestroy();
    expect(drainOnce).toHaveBeenCalledTimes(2);
  });
});
