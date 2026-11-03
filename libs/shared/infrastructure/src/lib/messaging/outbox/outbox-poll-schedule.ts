import { Inject, Injectable } from '@nestjs/common';
import { Clock } from '@investflow/shared-application';
import { UtcInstant } from '@investflow/shared-domain';
import { outboxConfig, type OutboxConfig } from './outbox.config';

export interface CompletedPoll {
  readonly startedAt: UtcInstant;
  readonly claimedRows: number;
  readonly isBatchFull: boolean;
}

// Decides when the outbox poller polls next. The poller finds work only when
// something went wrong, so each empty poll doubles the wait up to the maximum
// and a poll that claims rows returns it to the minimum. The relay and the
// publisher of this process know when the rows they leave become claimable
// and wake the poller then, so backing off does not delay them; rows of
// other processes wait up to the maximum after a quiet period.
@Injectable()
export class OutboxPollSchedule {
  private readonly minIntervalMs: number;
  private readonly maxIntervalMs: number;
  private intervalMs: number;
  private wasLastPollEmpty = false;
  private lastPollEndedAt = 0;
  // Epoch milliseconds, ascending, at most one per window of the minimum
  // interval: the latest of a window serves the earlier ones at most that
  // interval late, and the count stays below the longest delay a caller
  // passes (the 5-minute retry ceiling) over the interval.
  private wakeUps: number[] = [];
  private interruptWait: (() => void) | undefined;

  constructor(
    private readonly clock: Clock,
    @Inject(outboxConfig.KEY) config: OutboxConfig,
  ) {
    this.minIntervalMs = config.pollMinIntervalMs;
    this.maxIntervalMs = config.pollMaxIntervalMs;
    this.intervalMs = this.minIntervalMs;
  }

  // Brings a poll forward to the given time, never within the minimum of the
  // previous poll. A wake-up arriving during a poll is for the next one.
  wakePollerAt(at: UtcInstant): void {
    const atMs = at.epochMilliseconds;
    const [earliestBefore] = this.wakeUps;
    const window = Math.floor(atMs / this.minIntervalMs);
    const index = this.wakeUps.findIndex(
      (wakeUp) => Math.floor(wakeUp / this.minIntervalMs) >= window,
    );
    if (index === -1) {
      this.wakeUps.push(atMs);
    } else if (Math.floor(this.wakeUps[index] / this.minIntervalMs) > window) {
      this.wakeUps.splice(index, 0, atMs);
    } else {
      this.wakeUps[index] = Math.max(this.wakeUps[index], atMs);
    }
    if (this.wakeUps[0] !== earliestBefore) this.interruptWait?.();
  }

  // Resolves at once after a full batch; otherwise at the earlier of the
  // backed-off interval and the earliest wake-up.
  async waitAfterPoll(poll: CompletedPoll, signal: AbortSignal): Promise<void> {
    this.lastPollEndedAt = this.clock.now().epochMilliseconds;
    const served = this.wakeUps.findIndex(
      (wakeUp) => wakeUp > poll.startedAt.epochMilliseconds,
    );
    this.wakeUps = served === -1 ? [] : this.wakeUps.slice(served);
    const isEmpty = poll.claimedRows === 0;
    this.intervalMs =
      isEmpty && this.wasLastPollEmpty
        ? Math.min(this.intervalMs * 2, this.maxIntervalMs)
        : this.minIntervalMs;
    this.wasLastPollEmpty = isEmpty;
    if (poll.isBatchFull) return;

    while (!signal.aborted) {
      const waitMs = this.nextPollAt() - this.clock.now().epochMilliseconds;
      if (waitMs <= 0) return;
      await this.sleep(waitMs, signal, true);
    }
  }

  // A paused poll learned nothing, so it keeps the interval and its pending
  // wake-ups, and checks the pause again after the minimum.
  async waitAfterPausedPoll(signal: AbortSignal): Promise<void> {
    await this.sleep(this.minIntervalMs, signal, false);
  }

  private nextPollAt(): number {
    const scheduledAt = this.lastPollEndedAt + this.intervalMs;
    const [wakeUp] = this.wakeUps;
    if (wakeUp === undefined) return scheduledAt;

    const earliestAt = this.lastPollEndedAt + this.minIntervalMs;
    return Math.min(scheduledAt, Math.max(wakeUp, earliestAt));
  }

  private sleep(
    ms: number,
    signal: AbortSignal,
    isInterruptible: boolean,
  ): Promise<void> {
    if (signal.aborted) return Promise.resolve();

    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', done);
        if (this.interruptWait === done) this.interruptWait = undefined;
        resolve();
      };
      const timer = setTimeout(done, ms);
      signal.addEventListener('abort', done, { once: true });
      if (isInterruptible) this.interruptWait = done;
    });
  }
}
