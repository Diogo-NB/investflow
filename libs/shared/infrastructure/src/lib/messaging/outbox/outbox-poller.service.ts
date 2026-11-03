import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { Clock } from '@investflow/shared-application';
import { PrismaService } from '../../persistence/prisma/prisma.service';
import { OutboxPollSchedule } from './outbox-poll-schedule';
import { OutboxPublisher } from './outbox-publisher';
import { GRACE_PERIOD_MS } from './outbox-relay';

// The claim holds its rows' locks while publishing, so a batch must publish
// well within the transaction timeout: 100 rows are 10 requests.
const CLAIM_BATCH_SIZE = 100;

interface ClaimedRow {
  readonly id: string;
  readonly eventType: string;
  readonly context: string;
  readonly payload: unknown;
  readonly attempts: number;
}

// Publishes what the relay did not: failed rows once due, and rows the relay
// dropped or lost to a crash. Claims rows with SKIP LOCKED, so any number of
// processes can poll the same outbox and each row is published by one.
// When to poll is OutboxPollSchedule's decision.
@Injectable()
export class OutboxPollerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(OutboxPollerService.name);
  private readonly shutdown = new AbortController();
  private loop: Promise<void> | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: OutboxPublisher,
    private readonly pollSchedule: OutboxPollSchedule,
    private readonly clock: Clock,
  ) {}

  onApplicationBootstrap(): void {
    this.logger.log('Outbox poller started');
    this.loop = this.run();
  }

  async onModuleDestroy(): Promise<void> {
    this.shutdown.abort();
    await this.loop;
  }

  // Returns how many rows it claimed.
  async drainOnce(): Promise<number> {
    if (this.publisher.isPaused()) return 0;

    return this.prisma.$transaction(async (client) => {
      const now = this.clock.now();
      // The planner reads the partial index of unpublished rows only when the
      // query repeats its predicate, published_at IS NULL.
      const rows = await client.$queryRaw<ClaimedRow[]>`
        SELECT id, event_type AS "eventType", context, payload, attempts
        FROM outbox_events
        WHERE published_at IS NULL
          AND (next_attempt_at <= ${now.date}
            OR (next_attempt_at IS NULL
              AND created_at < ${now.addMs(-GRACE_PERIOD_MS).date}))
        ORDER BY created_at
        LIMIT ${CLAIM_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED`;
      if (rows.length === 0) return 0;

      const { published, failed } = await this.publisher.publish(
        rows.map((row) => ({
          message: {
            eventId: row.id,
            eventType: row.eventType,
            context: row.context,
            payload: JSON.stringify(row.payload),
          },
          attempts: row.attempts,
        })),
      );
      // Through the claiming transaction: another connection would wait on
      // the locks it holds.
      await this.publisher.markPublished(client, published);
      await this.publisher.recordFailures(client, failed);
      // Rare: the poller finds rows only after the relay could not publish.
      this.logger.log(
        `Claimed ${rows.length} outbox event(s): published ${published.length}, failed ${failed.length}, skipped while paused ${rows.length - published.length - failed.length}`,
      );
      return rows.length;
    });
  }

  private async run(): Promise<void> {
    const { signal } = this.shutdown;
    while (!signal.aborted) {
      if (this.publisher.isPaused()) {
        await this.pollSchedule.waitAfterPausedPoll(signal);
        continue;
      }

      const startedAt = this.clock.now();
      const claimedRows = await this.drainOnce().catch((error: unknown) => {
        this.logger.error('Outbox poll failed', error);
        return 0;
      });
      await this.pollSchedule.waitAfterPoll(
        {
          startedAt,
          claimedRows,
          isBatchFull: claimedRows === CLAIM_BATCH_SIZE,
        },
        signal,
      );
    }
  }
}
