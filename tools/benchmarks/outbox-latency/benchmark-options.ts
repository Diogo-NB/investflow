import { parseArgs } from 'node:util';

export const brokerKinds = ['floci', 'simulated'] as const;
export type BrokerKind = (typeof brokerKinds)[number];

export const loadNames = ['steady', 'concurrent', 'fanout'] as const;
export type LoadName = (typeof loadNames)[number];

export interface BenchmarkOptions {
  readonly broker: BrokerKind;
  // Round trip of the simulated broker, varied by ±30% per call.
  readonly rttMs: number;
  readonly loads: readonly LoadName[];
  readonly steady: {
    readonly transactionsPerSecond: number;
    readonly minEvents: number;
    readonly maxEvents: number;
    readonly durationMs: number;
  };
  readonly concurrent: {
    readonly transactions: number;
    readonly inFlight: number;
  };
  readonly fanout: { readonly events: number };
  readonly idleMs: number;
  readonly timeoutMs: number;
}

export const usage = `Usage: pnpm bench:outbox [options]

  --broker floci|simulated   Publish to Floci or to a simulated broker (simulated)
  --rtt-ms <n>               Simulated broker round trip in ms, ±30% (30)
  --loads <list>             Comma-separated: steady,concurrent,fanout (all)
  --rate <n>                 steady: transactions per second (20)
  --events-min <n>           steady: fewest events per transaction (1)
  --events-max <n>           steady: most events per transaction (3)
  --duration-s <n>           steady: seconds of load (15)
  --transactions <n>         concurrent: single-event transactions (500)
  --parallel <n>             concurrent: transactions in flight (10)
  --events <n>               fanout: events in one transaction (3000)
  --idle-s <n>               Whole seconds of idle database use to measure (3)
  --timeout-s <n>            Seconds to wait for a load to be published (300)
  --help                     Show this help`;

// Returns undefined when help was asked for.
export function parseBenchmarkOptions(
  args: readonly string[],
): BenchmarkOptions | undefined {
  const { values } = parseArgs({
    args: [...args],
    strict: true,
    options: {
      broker: { type: 'string', default: 'simulated' },
      'rtt-ms': { type: 'string', default: '30' },
      loads: { type: 'string', default: loadNames.join(',') },
      rate: { type: 'string', default: '20' },
      'events-min': { type: 'string', default: '1' },
      'events-max': { type: 'string', default: '3' },
      'duration-s': { type: 'string', default: '15' },
      transactions: { type: 'string', default: '500' },
      parallel: { type: 'string', default: '10' },
      events: { type: 'string', default: '3000' },
      'idle-s': { type: 'string', default: '3' },
      'timeout-s': { type: 'string', default: '300' },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) return undefined;

  const minEvents = positiveInteger('events-min', values['events-min']);
  const maxEvents = positiveInteger('events-max', values['events-max']);
  if (minEvents > maxEvents) {
    throw new Error('--events-min must not exceed --events-max');
  }

  return {
    broker: oneOf('broker', values.broker, brokerKinds),
    rttMs: positiveNumber('rtt-ms', values['rtt-ms']),
    loads: values.loads
      .split(',')
      .map((name) => oneOf('loads', name.trim(), loadNames)),
    steady: {
      transactionsPerSecond: positiveNumber('rate', values.rate),
      minEvents,
      maxEvents,
      durationMs: positiveNumber('duration-s', values['duration-s']) * 1_000,
    },
    concurrent: {
      transactions: positiveInteger('transactions', values.transactions),
      inFlight: positiveInteger('parallel', values.parallel),
    },
    fanout: { events: positiveInteger('events', values.events) },
    idleMs: positiveInteger('idle-s', values['idle-s']) * 1_000,
    timeoutMs: positiveNumber('timeout-s', values['timeout-s']) * 1_000,
  };
}

function positiveNumber(name: string, raw: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`--${name} must be a positive number, got "${raw}"`);
  }
  return value;
}

function positiveInteger(name: string, raw: string): number {
  const value = positiveNumber(name, raw);
  if (!Number.isInteger(value)) {
    throw new Error(`--${name} must be a whole number, got "${raw}"`);
  }
  return value;
}

function oneOf<T extends string>(
  name: string,
  raw: string,
  allowed: readonly T[],
): T {
  const value = allowed.find((candidate) => candidate === raw);
  if (!value) {
    throw new Error(
      `--${name} must be one of ${allowed.join(', ')}, got "${raw}"`,
    );
  }
  return value;
}
