import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { OutboxEvent } from '@prisma/client';
import { Clock } from '@investflow/shared-application';
import {
  AppError,
  EAppErrorCode,
  Result,
  UtcInstant,
} from '@investflow/shared-domain';
import { PrismaService } from '../../persistence/prisma/prisma.service';
import { MessageBroker } from './message-broker.port';

const BATCH_SIZE = 100;
const MAX_RETRY_DELAY_MS = 5 * 60_000;
const MAX_LAST_ERROR_LENGTH = 1_000;
// Consecutive failures of different events point at the broker rather than
// at one event, so the poller pauses instead of failing every pending event.
const FAILURES_BEFORE_PAUSE = 3;
const MAX_PAUSE_MS = 60_000;

class OutboxPublishError extends AppError {
  constructor(eventId: string, cause: unknown) {
    super('Não foi possível publicar o evento.', {
      code: EAppErrorCode.OUTBOX_PUBLISH_FAILED,
      kind: 'external',
      metadata: { eventId },
      cause,
    });
  }
}

@Injectable()
export class OutboxPollerService {
  private readonly logger = new Logger(OutboxPollerService.name);
  private polling = false;
  private pausedUntil: UtcInstant | undefined;
  private pauseMs = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly messageBroker: MessageBroker,
    private readonly clock: Clock,
  ) {}

  @Cron(CronExpression.EVERY_SECOND)
  async poll(): Promise<void> {
    if (this.polling) return;
    if (this.pausedUntil && this.clock.now().isBefore(this.pausedUntil)) {
      return;
    }

    this.polling = true;
    try {
      await this.publishDue();
    } finally {
      this.polling = false;
    }
  }

  private async publishDue(): Promise<void> {
    const now = this.clock.now().date;
    const events = await this.prisma.client.outboxEvent.findMany({
      where: {
        publishedAt: null,
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });

    let consecutiveFailures = 0;
    for (const event of events) {
      const published = await this.publish(event);
      if (published.isOk()) {
        consecutiveFailures = 0;
        this.resume();
        continue;
      }

      consecutiveFailures += 1;
      if (consecutiveFailures >= FAILURES_BEFORE_PAUSE) {
        this.pause();
        return;
      }
    }
  }

  // Marking happens after publishing, so a crash in between publishes the
  // event again; consumers deduplicate by event ID.
  private async publish(
    event: OutboxEvent,
  ): Promise<Result<void, OutboxPublishError>> {
    const published = await Result.fromPromise(
      () =>
        this.messageBroker.publish({
          eventId: event.id,
          eventType: event.eventType,
          context: event.context,
          payload: JSON.stringify(event.payload),
        }),
      (error) => new OutboxPublishError(event.id, error),
    );
    if (published.isErr()) {
      await this.recordFailure(event, published.error);
      return published;
    }

    await this.prisma.client.outboxEvent.update({
      where: { id: event.id },
      data: { publishedAt: this.clock.now().date },
    });
    return published;
  }

  private async recordFailure(
    event: OutboxEvent,
    error: OutboxPublishError,
  ): Promise<void> {
    const attempts = event.attempts + 1;
    const delayMs = Math.min(1_000 * 2 ** (attempts - 1), MAX_RETRY_DELAY_MS);
    const { cause } = error;
    const message = cause instanceof Error ? cause.message : String(cause);
    this.logger.warn(
      `Failed to publish outbox event ${event.id} (attempt ${attempts}), retrying in ${delayMs / 1_000}s: ${message}`,
    );

    await this.prisma.client.outboxEvent.update({
      where: { id: event.id },
      data: {
        attempts,
        nextAttemptAt: this.clock.now().addMs(delayMs).date,
        lastError: message.slice(0, MAX_LAST_ERROR_LENGTH),
      },
    });
  }

  private pause(): void {
    if (this.pauseMs === 0) {
      this.logger.error(
        `Outbox publishing paused after ${FAILURES_BEFORE_PAUSE} consecutive failures`,
      );
    }
    this.pauseMs = Math.min(Math.max(this.pauseMs * 2, 1_000), MAX_PAUSE_MS);
    this.pausedUntil = this.clock.now().addMs(this.pauseMs);
  }

  private resume(): void {
    if (this.pauseMs === 0) return;

    this.logger.log('Outbox publishing resumed');
    this.pauseMs = 0;
    this.pausedUntil = undefined;
  }
}
