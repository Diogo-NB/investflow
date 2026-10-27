import { Injectable, Logger } from '@nestjs/common';
import { Clock } from '@investflow/shared-application';
import { UtcInstant } from '@investflow/shared-domain';
import type { TransactionalPrismaClient } from '../../persistence/prisma/prisma-client.type';
import {
  MAX_BATCH_BYTES,
  MAX_BATCH_MESSAGES,
  MessageBroker,
  OutboxMessage,
} from './message-broker.port';

// Shared by every publishing path of the process, so bursts stay within the
// broker's request quota: throughput is about requests × batch size / RTT.
const MAX_CONCURRENT_REQUESTS = 8;
// Bounds a row's life in the relay, which the poller's grace period relies on.
export const PUBLISH_TIMEOUT_MS = 2_000;
const MAX_RETRY_DELAY_MS = 5 * 60_000;
const MAX_LAST_ERROR_LENGTH = 1_000;
// Consecutive failed requests point at the broker rather than at one event,
// so publishing pauses instead of failing every pending event.
const FAILURES_BEFORE_PAUSE = 3;
const MAX_PAUSE_MS = 60_000;

export interface OutboxEntry {
  readonly message: OutboxMessage;
  readonly attempts: number;
}

export interface FailedEntry {
  readonly entry: OutboxEntry;
  readonly reason: string;
}

export interface PublishOutcome {
  readonly published: readonly string[];
  readonly failed: readonly FailedEntry[];
}

@Injectable()
export class OutboxPublisher {
  private readonly logger = new Logger(OutboxPublisher.name);
  private requestsInFlight = 0;
  private readonly waitingForSlot: (() => void)[] = [];
  private consecutiveFailures = 0;
  private pausedUntil: UtcInstant | undefined;
  private pauseMs = 0;

  constructor(
    private readonly messageBroker: MessageBroker,
    private readonly clock: Clock,
  ) {}

  static batchLength(entries: readonly OutboxEntry[], start = 0): number {
    let bytes = 0;
    let length = 0;
    const end = Math.min(entries.length, start + MAX_BATCH_MESSAGES);
    for (let index = start; index < end; index++) {
      const { message } = entries[index];
      bytes +=
        Buffer.byteLength(message.payload) +
        Buffer.byteLength(message.eventType) +
        Buffer.byteLength(message.context);
      if (length > 0 && bytes > MAX_BATCH_BYTES) break;
      length++;
    }
    return length;
  }

  isPaused(): boolean {
    return (
      this.pausedUntil !== undefined &&
      this.clock.now().isBefore(this.pausedUntil)
    );
  }

  hasCapacity(): boolean {
    return !this.isPaused() && this.requestsInFlight < MAX_CONCURRENT_REQUESTS;
  }

  // Never rejects. Entries left out of the outcome were skipped because
  // publishing paused, and stay unpublished for the poller.
  async publish(entries: readonly OutboxEntry[]): Promise<PublishOutcome> {
    const batches: OutboxEntry[][] = [];
    for (let start = 0; start < entries.length; ) {
      const length = OutboxPublisher.batchLength(entries, start);
      batches.push(entries.slice(start, start + length));
      start += length;
    }

    const outcomes = await Promise.all(
      batches.map((batch) => this.publishBatch(batch)),
    );
    return {
      published: outcomes.flatMap((outcome) => outcome.published),
      failed: outcomes.flatMap((outcome) => outcome.failed),
    };
  }

  async markPublished(
    client: TransactionalPrismaClient,
    ids: readonly string[],
  ): Promise<void> {
    if (ids.length === 0) return;

    await client.outboxEvent.updateMany({
      where: { id: { in: [...ids] } },
      data: { publishedAt: this.clock.now().date },
    });
  }

  async recordFailures(
    client: TransactionalPrismaClient,
    failed: readonly FailedEntry[],
  ): Promise<void> {
    const groups = new Map<string, FailedEntry[]>();
    for (const failure of failed) {
      const key = `${failure.entry.attempts}:${failure.reason}`;
      const group = groups.get(key);
      if (group) group.push(failure);
      else groups.set(key, [failure]);
    }

    for (const group of groups.values()) {
      const { entry, reason } = group[0];
      const attempts = entry.attempts + 1;
      const delayMs = Math.min(1_000 * 2 ** (attempts - 1), MAX_RETRY_DELAY_MS);
      this.logger.warn(
        `Failed to publish ${group.length} outbox event(s) (attempt ${attempts}), retrying in ${delayMs / 1_000}s: ${reason}`,
      );
      await client.outboxEvent.updateMany({
        where: {
          id: { in: group.map((failure) => failure.entry.message.eventId) },
        },
        data: {
          attempts,
          nextAttemptAt: this.clock.now().addMs(delayMs).date,
          lastError: reason.slice(0, MAX_LAST_ERROR_LENGTH),
        },
      });
    }
  }

  private async publishBatch(batch: OutboxEntry[]): Promise<PublishOutcome> {
    await this.acquireSlot();
    try {
      if (this.isPaused()) return { published: [], failed: [] };

      const rejected = await this.messageBroker.publish(
        batch.map((entry) => entry.message),
        AbortSignal.timeout(PUBLISH_TIMEOUT_MS),
      );
      this.recordSuccess();
      const reasons = new Map(
        rejected.map((message) => [message.eventId, message.reason]),
      );
      return {
        published: batch
          .filter((entry) => !reasons.has(entry.message.eventId))
          .map((entry) => entry.message.eventId),
        failed: batch.flatMap((entry) => {
          const reason = reasons.get(entry.message.eventId);
          return reason === undefined ? [] : [{ entry, reason }];
        }),
      };
    } catch (error) {
      this.recordFailure();
      const reason = error instanceof Error ? error.message : String(error);
      return {
        published: [],
        failed: batch.map((entry) => ({ entry, reason })),
      };
    } finally {
      this.releaseSlot();
    }
  }

  // Takes a free slot synchronously when one exists, so a caller that saw
  // hasCapacity() gets it before anyone else.
  private acquireSlot(): Promise<void> {
    if (this.requestsInFlight < MAX_CONCURRENT_REQUESTS) {
      this.requestsInFlight++;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.waitingForSlot.push(resolve));
  }

  private releaseSlot(): void {
    const next = this.waitingForSlot.shift();
    if (next) next();
    else this.requestsInFlight--;
  }

  private recordFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures < FAILURES_BEFORE_PAUSE || this.isPaused()) {
      return;
    }

    if (this.pauseMs === 0) {
      this.logger.error(
        `Outbox publishing paused after ${FAILURES_BEFORE_PAUSE} consecutive failures`,
      );
    }
    this.pauseMs = Math.min(Math.max(this.pauseMs * 2, 1_000), MAX_PAUSE_MS);
    this.pausedUntil = this.clock.now().addMs(this.pauseMs);
  }

  private recordSuccess(): void {
    this.consecutiveFailures = 0;
    if (this.pauseMs === 0) return;

    this.logger.log('Outbox publishing resumed');
    this.pauseMs = 0;
    this.pausedUntil = undefined;
  }
}
