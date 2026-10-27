import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Clock } from '@investflow/shared-application';
import { UtcInstant } from '@investflow/shared-domain';
import { PrismaService } from '../../persistence/prisma/prisma.service';
import {
  OutboxEntry,
  OutboxPublisher,
  PUBLISH_TIMEOUT_MS,
} from './outbox-publisher';
import type { OutboxRow } from './outbox-writer';

// About what the publisher's concurrent requests send within the stale age;
// a larger buffer would only hold rows that go stale.
const MAX_BUFFERED_ROWS = 5_000;
// Rows the relay could not send this soon are left to the poller, whose grace
// period must exceed this age plus a request's timeout.
const MAX_BUFFERED_AGE_MS = 2_500;
export const RELAY_HANDOVER_MS = MAX_BUFFERED_AGE_MS + PUBLISH_TIMEOUT_MS;
const SHUTDOWN_DEADLINE_MS = 5_000;

interface BufferedEntry {
  readonly entry: OutboxEntry;
  readonly enqueuedAt: UtcInstant;
}

// Publishes the rows of a committed unit of work right away. Best effort:
// whatever it does not mark published, the outbox poller publishes later.
@Injectable()
export class OutboxRelay implements OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelay.name);
  private readonly incoming: { rows: readonly OutboxRow[]; at: UtcInstant }[] =
    [];
  private buffered: BufferedEntry[] = [];
  private bufferedRows = 0;
  private pumpScheduled = false;
  private readonly requests = new Set<Promise<void>>();
  private readonly publishedIds: string[] = [];
  private marking: Promise<void> | undefined;
  private closed = false;

  constructor(
    private readonly publisher: OutboxPublisher,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  // Runs on the request's path after commit, so it only queues the rows;
  // serializing and publishing them wait for the next turn of the event loop.
  enqueue(rows: readonly OutboxRow[]): void {
    if (this.closed || rows.length === 0 || this.publisher.isPaused()) return;

    const accepted = rows.slice(0, MAX_BUFFERED_ROWS - this.bufferedRows);
    if (accepted.length < rows.length) {
      this.leaveToPoller(rows.length - accepted.length, 'the relay is full');
    }
    if (accepted.length === 0) return;

    this.bufferedRows += accepted.length;
    this.incoming.push({ rows: accepted, at: this.clock.now() });
    if (this.pumpScheduled) return;

    this.pumpScheduled = true;
    setImmediate(() => {
      this.pumpScheduled = false;
      this.pump();
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.closed = true;
    const drained = (async () => {
      while (this.requests.size > 0 || this.marking) {
        await Promise.all([...this.requests, this.marking]);
      }
    })();
    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, SHUTDOWN_DEADLINE_MS);
    });
    await Promise.race([drained, deadline]);
    clearTimeout(timer);
  }

  private pump(): void {
    this.takeIncoming();
    this.dropStale();
    while (this.buffered.length > 0 && this.publisher.hasCapacity()) {
      const length = OutboxPublisher.batchLength(
        this.buffered.map((buffered) => buffered.entry),
      );
      const batch = this.buffered.splice(0, length);
      this.bufferedRows -= batch.length;
      this.send(batch.map((buffered) => buffered.entry));
    }
    if (this.buffered.length > 0 && this.publisher.isPaused()) {
      this.leaveToPoller(this.buffered.length, 'publishing is paused');
      this.bufferedRows -= this.buffered.length;
      this.buffered = [];
    }
  }

  private send(batch: OutboxEntry[]): void {
    const request = (async () => {
      const { published, failed } = await this.publisher.publish(batch);
      this.publishedIds.push(...published);
      this.flushMarks();
      if (failed.length > 0) {
        await this.publisher
          .recordFailures(this.prisma.client, failed)
          .catch((error: unknown) =>
            this.logger.error('Failed to record outbox failures', error),
          );
      }
    })();
    this.requests.add(request);
    void request.finally(() => {
      this.requests.delete(request);
      if (!this.closed) this.pump();
    });
  }

  // One update at a time, covering every id acknowledged meanwhile.
  private flushMarks(): void {
    if (this.marking || this.publishedIds.length === 0) return;

    const ids = this.publishedIds.splice(0);
    this.marking = this.publisher
      .markPublished(this.prisma.client, ids)
      .catch((error: unknown) =>
        this.logger.error(
          `Failed to mark ${ids.length} outbox event(s) published; the poller will publish them again`,
          error,
        ),
      )
      .finally(() => {
        this.marking = undefined;
        this.flushMarks();
      });
  }

  private takeIncoming(): void {
    for (const { rows, at } of this.incoming.splice(0)) {
      for (const row of rows) {
        this.buffered.push({
          entry: {
            message: {
              eventId: row.id,
              eventType: row.eventType,
              context: row.context,
              payload: JSON.stringify(row.payload),
            },
            attempts: 0,
          },
          enqueuedAt: at,
        });
      }
    }
  }

  private dropStale(): void {
    const staleBefore = this.clock.now().addMs(-MAX_BUFFERED_AGE_MS);
    const fresh = this.buffered.findIndex(
      (buffered) => !buffered.enqueuedAt.isBefore(staleBefore),
    );
    const stale = fresh === -1 ? this.buffered.length : fresh;
    if (stale === 0) return;

    this.buffered.splice(0, stale);
    this.bufferedRows -= stale;
    this.leaveToPoller(stale, 'they waited too long');
  }

  private leaveToPoller(count: number, reason: string): void {
    this.logger.warn(
      `Left ${count} outbox event(s) to the poller because ${reason}`,
    );
  }
}
