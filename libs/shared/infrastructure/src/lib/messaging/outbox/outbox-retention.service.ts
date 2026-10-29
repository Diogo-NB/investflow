import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { Clock } from '@investflow/shared-application';
import { PrismaService } from '../../persistence/prisma/prisma.service';

const RETENTION_MS = 7 * 24 * 60 * 60_000;
// Each batch is its own statement, so it locks only the rows it deletes and
// its run time and WAL stay small however large the backlog is.
const DELETE_BATCH_SIZE = 1_000;
// Rows expire continuously; the interval only sets how many pile up between
// runs, so a longer one would make each run a bigger burst.
const DELETE_INTERVAL_MS = 5 * 60_000;
// Spreads a large backlog, such as the first run on an old table, while
// still deleting faster than an instance can publish.
const PAUSE_BETWEEN_BATCHES_MS = 100;

// Deletes published rows once nobody needs them to debug or replay an event.
// Every publishing instance runs it; SKIP LOCKED gives concurrent instances
// disjoint rows.
@Injectable()
export class OutboxRetentionService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(OutboxRetentionService.name);
  private loop: Promise<void> | undefined;
  private stopped = false;
  private wake: (() => void) | undefined;

  constructor(
    private readonly prisma: PrismaService,
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

  // Returns how many rows it deleted.
  async deleteExpiredOnce(): Promise<number> {
    const cutoff = this.clock.now().addMs(-RETENTION_MS);
    return this.prisma.client.$executeRaw`
      DELETE FROM outbox_events
      WHERE id IN (
        SELECT id
        FROM outbox_events
        WHERE published_at < ${cutoff.date}
        ORDER BY published_at
        LIMIT ${DELETE_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED)`;
  }

  // Waits an interval first, so starting a process does no cleanup work.
  private async run(): Promise<void> {
    await this.sleep(DELETE_INTERVAL_MS);
    while (!this.stopped) {
      const deleted = await this.deleteExpiredOnce().catch((error: unknown) => {
        this.logger.error('Outbox retention failed', error);
        return 0;
      });
      await this.sleep(
        deleted < DELETE_BATCH_SIZE
          ? DELETE_INTERVAL_MS
          : PAUSE_BETWEEN_BATCHES_MS,
      );
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
