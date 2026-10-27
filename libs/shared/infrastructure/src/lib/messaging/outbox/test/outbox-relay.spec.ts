import { Logger } from '@nestjs/common';
import { Clock } from '@investflow/shared-application';
import { CalendarDate, UtcInstant } from '@investflow/shared-domain';
import { PrismaService } from '../../../persistence/prisma/prisma.service';
import { MessageBroker, RejectedMessage } from '../message-broker.port';
import { OutboxPublisher } from '../outbox-publisher';
import { OutboxRelay } from '../outbox-relay';
import type { OutboxRow } from '../outbox-writer';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

const startedAt = UtcInstant.ofIso('2026-01-02T03:04:05Z');

function row(id: string): OutboxRow {
  return {
    id,
    aggregateType: 'TestAggregate',
    aggregateId: `aggregate-${id}`,
    eventType: 'TestHappened',
    context: 'test',
    payload: { eventId: id },
    occurredAt: startedAt.date,
  };
}

function rows(count: number, prefix = 'event'): OutboxRow[] {
  return Array.from({ length: count }, (_, index) => row(`${prefix}-${index}`));
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
  const prisma = {
    client: { outboxEvent: { updateMany } },
  } as unknown as PrismaService;
  const publisher = new OutboxPublisher(
    { publish } as unknown as MessageBroker,
    clock,
  );
  return {
    relay: new OutboxRelay(publisher, prisma, clock),
    publisher,
    publish,
    updateMany,
    advance: (milliseconds: number) => {
      now = now.addMs(milliseconds);
    },
  };
}

function publishedIds(publish: jest.Mock): string[] {
  return publish.mock.calls.flatMap(([messages]) =>
    messages.map((message: { eventId: string }) => message.eventId),
  );
}

function markedIds(updateMany: jest.Mock): string[] {
  return updateMany.mock.calls
    .filter(([args]) => 'publishedAt' in args.data)
    .flatMap(([args]) => args.where.id.in);
}

async function settle(): Promise<void> {
  for (let turn = 0; turn < 5; turn++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

describe('OutboxRelay', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  it('publishes committed rows on the next turn of the event loop and marks them', async () => {
    const { relay, publish, updateMany } = createFixture();

    relay.enqueue(rows(2));
    expect(publish).not.toHaveBeenCalled();
    await settle();

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        eventId: 'event-0',
        eventType: 'TestHappened',
        context: 'test',
        payload: '{"eventId":"event-0"}',
      }),
      expect.objectContaining({ eventId: 'event-1' }),
    ]);
    expect(markedIds(updateMany)).toEqual(['event-0', 'event-1']);
  });

  it('batches the rows of commits that arrive together', async () => {
    const { relay, publish } = createFixture();

    relay.enqueue(rows(3, 'a'));
    relay.enqueue(rows(4, 'b'));
    relay.enqueue(rows(5, 'c'));
    await settle();

    expect(publish.mock.calls.map(([messages]) => messages.length)).toEqual([
      10, 2,
    ]);
  });

  it('marks ids acknowledged during a mark in one more update', async () => {
    const { relay, publish, updateMany } = createFixture();
    let releaseMark!: () => void;
    updateMany.mockReturnValueOnce(
      new Promise((resolve) => (releaseMark = () => resolve({}))),
    );
    let releaseSecond!: (value: readonly RejectedMessage[]) => void;
    publish
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(new Promise((resolve) => (releaseSecond = resolve)))
      .mockReturnValueOnce(
        new Promise((resolve) => setImmediate(() => resolve([]))),
      );

    relay.enqueue(rows(10, 'a'));
    relay.enqueue(rows(10, 'b'));
    relay.enqueue(rows(10, 'c'));
    await settle();
    releaseSecond([]);
    await settle();
    releaseMark();
    await settle();

    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(markedIds(updateMany)).toHaveLength(30);
  });

  it('records rejected rows for the poller to retry', async () => {
    const { relay, publish, updateMany } = createFixture();
    publish.mockResolvedValueOnce([
      { eventId: 'event-1', reason: 'too large' },
    ]);

    relay.enqueue(rows(2));
    await settle();

    expect(markedIds(updateMany)).toEqual(['event-0']);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['event-1'] } },
      data: expect.objectContaining({ attempts: 1, lastError: 'too large' }),
    });
  });

  it('leaves rows beyond its capacity to the poller', async () => {
    const { relay, publish } = createFixture();

    relay.enqueue(rows(4_995, 'a'));
    relay.enqueue(rows(10, 'b'));
    await settle();

    const published = publishedIds(publish);
    expect(published).toHaveLength(5_000);
    expect(published).toContain('b-4');
    expect(published).not.toContain('b-5');
  });

  it('leaves rows that waited too long to the poller', async () => {
    const { relay, publish, advance } = createFixture();

    relay.enqueue(rows(2));
    advance(2_501);
    await settle();

    expect(publish).not.toHaveBeenCalled();
  });

  it('ignores commits while publishing is paused', async () => {
    const { relay, publisher, publish } = createFixture();
    jest.spyOn(publisher, 'isPaused').mockReturnValue(true);

    relay.enqueue(rows(2));
    await settle();

    expect(publish).not.toHaveBeenCalled();
  });

  it('waits for requests in flight and their marks on shutdown, then accepts nothing', async () => {
    const { relay, publish, updateMany } = createFixture();
    let release!: (value: readonly RejectedMessage[]) => void;
    publish.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));

    relay.enqueue(rows(1));
    await settle();
    const destroyed = relay.onModuleDestroy();
    release([]);
    await destroyed;

    expect(markedIds(updateMany)).toEqual(['event-0']);

    relay.enqueue(rows(1, 'late'));
    await settle();
    expect(publish).toHaveBeenCalledTimes(1);
  });
});
