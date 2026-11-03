import { performance } from 'node:perf_hooks';
import { Injectable } from '@nestjs/common';
import { OutboxPollerService } from '@investflow/shared-infrastructure';

export interface ObservedPoll {
  // performance.now() when the poll started.
  readonly at: number;
  readonly claimed: number;
}

// The poller's loop calls its public drainOnce() for every poll, so
// overriding it observes the real loop without changing it.
@Injectable()
export class ObservedOutboxPoller extends OutboxPollerService {
  readonly polls: ObservedPoll[] = [];

  override async drainOnce(): Promise<number> {
    const at = performance.now();
    let claimed = 0;
    try {
      claimed = await super.drainOnce();
      return claimed;
    } finally {
      this.polls.push({ at, claimed });
    }
  }

  pollsBetween(start: number, end: number): readonly ObservedPoll[] {
    return this.polls.filter((poll) => poll.at >= start && poll.at <= end);
  }

  // The latest poll before the given time, which the first gap of a window
  // is measured from.
  pollBefore(time: number): ObservedPoll | undefined {
    return this.polls.findLast((poll) => poll.at < time);
  }
}
