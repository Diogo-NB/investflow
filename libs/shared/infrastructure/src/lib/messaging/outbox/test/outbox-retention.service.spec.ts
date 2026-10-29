import { Logger } from '@nestjs/common';
import { Clock } from '@investflow/shared-application';
import { CalendarDate, UtcInstant } from '@investflow/shared-domain';
import { PrismaService } from '../../../persistence/prisma/prisma.service';
import { OutboxRetentionService } from '../outbox-retention.service';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

const startedAt = UtcInstant.ofIso('2026-01-09T03:04:05Z');
const INTERVAL_MS = 5 * 60_000;

function createFixture(...deletedPerBatch: number[]) {
  const executeRaw = jest.fn();
  for (const deleted of deletedPerBatch) {
    executeRaw.mockResolvedValueOnce(deleted);
  }
  executeRaw.mockResolvedValue(0);
  const prisma = {
    client: { $executeRaw: executeRaw },
  } as unknown as PrismaService;
  const clock: Clock = {
    now: () => startedAt,
    today: () => CalendarDate.of('2026-01-09'),
  };
  return {
    retention: new OutboxRetentionService(prisma, clock),
    executeRaw,
  };
}

describe('OutboxRetentionService', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('deletes rows published over 7 days ago, oldest first, without waiting for locked ones', async () => {
    const { retention, executeRaw } = createFixture();

    await retention.deleteExpiredOnce();

    const [strings, ...values] = executeRaw.mock.calls[0];
    const sql = strings.join('?').replace(/\s+/g, ' ');
    expect(sql).toContain('WHERE published_at < ?');
    expect(sql).toContain('ORDER BY published_at');
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(values).toEqual([new Date('2026-01-02T03:04:05Z'), 1_000]);
  });

  it('first deletes one interval after start, then once per interval', async () => {
    const { retention, executeRaw } = createFixture();

    retention.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(INTERVAL_MS - 1);
    expect(executeRaw).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(executeRaw).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(executeRaw).toHaveBeenCalledTimes(2);

    await retention.onModuleDestroy();
  });

  it('deletes the next batch after a short pause while batches come back full', async () => {
    const { retention, executeRaw } = createFixture(1_000, 1_000, 10);

    retention.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(executeRaw).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(100);
    expect(executeRaw).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(100);
    expect(executeRaw).toHaveBeenCalledTimes(3);
    await jest.advanceTimersByTimeAsync(INTERVAL_MS - 1);
    expect(executeRaw).toHaveBeenCalledTimes(3);

    await retention.onModuleDestroy();
  });

  it('logs a failed batch and tries again after an interval', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { retention, executeRaw } = createFixture();
    executeRaw.mockRejectedValueOnce(new Error('connection lost'));

    retention.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(error).toHaveBeenCalledWith(
      'Outbox retention failed',
      expect.any(Error),
    );
    await jest.advanceTimersByTimeAsync(INTERVAL_MS);

    expect(executeRaw).toHaveBeenCalledTimes(2);
    await retention.onModuleDestroy();
  });

  it('stops at once on shutdown without deleting again', async () => {
    const { retention, executeRaw } = createFixture(1_000);

    retention.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(INTERVAL_MS);
    await retention.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(INTERVAL_MS);

    expect(executeRaw).toHaveBeenCalledTimes(1);
  });
});
