import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import type { BenchmarkOptions, LoadName } from './benchmark-options';

// Commits one unit of work recording the given number of events.
export type WriteTransaction = (events: number) => Promise<void>;

export interface Load {
  readonly description: string;
  run(write: WriteTransaction): Promise<void>;
}

export function createLoad(name: LoadName, options: BenchmarkOptions): Load {
  switch (name) {
    case 'steady':
      return steadyLoad(options.steady);
    case 'concurrent':
      return concurrentLoad(options.concurrent);
    case 'fanout':
      return fanoutLoad(options.fanout);
  }
}

// Independent requests: exponential gaps between transactions around the
// given rate, like users acting on their own.
function steadyLoad({
  transactionsPerSecond,
  minEvents,
  maxEvents,
  durationMs,
}: BenchmarkOptions['steady']): Load {
  return {
    description: `steady ${transactionsPerSecond} tx/s, ${minEvents}-${maxEvents} events/tx`,
    async run(write) {
      const writes: Promise<void>[] = [];
      const startedAt = performance.now();
      while (performance.now() - startedAt < durationMs) {
        const events =
          minEvents + Math.floor(Math.random() * (maxEvents - minEvents + 1));
        writes.push(write(events));
        await sleep(
          -Math.log(1 - Math.random()) * (1_000 / transactionsPerSecond),
        );
      }
      await Promise.all(writes);
    },
  };
}

// A spike: single-event transactions as fast as the given number of
// concurrent writers can commit them.
function concurrentLoad({
  transactions,
  inFlight,
}: BenchmarkOptions['concurrent']): Load {
  return {
    description: `concurrent ${transactions} tx, ${inFlight} in flight`,
    async run(write) {
      let started = 0;
      const writer = async () => {
        while (started < transactions) {
          started++;
          await write(1);
        }
      };
      await Promise.all(Array.from({ length: inFlight }, writer));
    },
  };
}

// A premise change reaching many simulations: one transaction, many events.
function fanoutLoad({ events }: BenchmarkOptions['fanout']): Load {
  return {
    description: `fan-out ${events} events in 1 tx`,
    run: (write) => write(events),
  };
}
