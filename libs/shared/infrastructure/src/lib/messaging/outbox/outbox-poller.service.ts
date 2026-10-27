import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { Clock } from '@investflow/shared-application';
import { PrismaService } from '../../persistence/prisma/prisma.service';
import { OutboxPublisher } from './outbox-publisher';
import { RELAY_HANDOVER_MS } from './outbox-relay';

// The claim holds its rows' locks while publishing, so a batch must publish
// well within the transaction timeout: 100 rows are 10 requests.
const CLAIM_BATCH_SIZE = 100;
// Retries back off at least a second and stranded rows are already past the
// grace period, so a faster loop would gain nothing.
const POLL_INTERVAL_MS = 1_000;
// A fresh row belongs to the relay of the process that committed it until
// the relay has sent or dropped it, plus a margin for marking it published.
const GRACE_PERIOD_MS = RELAY_HANDOVER_MS + 500;

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
@Injectable()
export class OutboxPollerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(OutboxPollerService.name);
  private loop: Promise<void> | undefined;
  private stopped = false;
  private wake: (() => void) | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: OutboxPublisher,
    private readonly clock: Clock,
  ) {}

  onApplicationBootstrap(): void {
    this.loop = this.run();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    this.wake?.();
    await this.loop;
  }

  // Returns how many rows it claimed.
  async drainOnce(): Promise<number> {
    if (this.publisher.isPaused()) return 0;

    return this.prisma.$transaction(async (client) => {
      const now = this.clock.now();
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
      return rows.length;
    });
  }

  private async run(): Promise<void> {
    while (!this.stopped) {
      const claimed = await this.drainOnce().catch((error: unknown) => {
        this.logger.error('Outbox poll failed', error);
        return 0;
      });
      if (claimed < CLAIM_BATCH_SIZE) await this.sleep(POLL_INTERVAL_MS);
    }
  }

  private sleep(ms: number): Promise<void> {
    if (this.stopped) return Promise.resolve();

    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      this.wake = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }
}
