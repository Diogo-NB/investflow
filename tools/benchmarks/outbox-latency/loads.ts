import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import type { BenchmarkOptions, LoadName } from './benchmark-options';

// Commits one unit of work recording the given number of events.
export type WriteTransaction = (events: number) => Promise<void>;

export interface Load {
  readonly description: string;
  // Commits through a host without OutboxModule, like the seed, so only a
  // poll finds its rows.
  readonly isStranded: boolean;
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
    case 'stranded':
      return strandedLoad(options.stranded);
  }
}

// Exponential gaps between transactions around the given rate, like users
// acting on their own.
async function writeAtRate(
  write: WriteTransaction,
  transactionsPerSecond: number,
  durationMs: number,
  events: () => number,
): Promise<void> {
  const writes: Promise<void>[] = [];
  const startedAt = performance.now();
  while (performance.now() - startedAt < durationMs) {
    writes.push(write(events()));
    await sleep(-Math.log(1 - Math.random()) * (1_000 / transactionsPerSecond));
  }
  await Promise.all(writes);
}

function steadyLoad({
  transactionsPerSecond,
  minEvents,
  maxEvents,
  durationMs,
}: BenchmarkOptions['steady']): Load {
  return {
    description: `steady ${transactionsPerSecond} tx/s, ${minEvents}-${maxEvents} events/tx`,
    isStranded: false,
    run: (write) =>
      writeAtRate(
        write,
        transactionsPerSecond,
        durationMs,
        () =>
          minEvents + Math.floor(Math.random() * (maxEvents - minEvents + 1)),
      ),
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
    isStranded: false,
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
    isStranded: false,
    run: (write) => write(events),
  };
}

// Rows of another process: a crash, the seed, or a host that relies on
// another's poller.
function strandedLoad({
  transactionsPerSecond,
  durationMs,
}: BenchmarkOptions['stranded']): Load {
  return {
    description: `stranded ${transactionsPerSecond} tx/s, 1 event/tx, no relay`,
    isStranded: true,
    run: (write) =>
      writeAtRate(write, transactionsPerSecond, durationMs, () => 1),
  };
}
