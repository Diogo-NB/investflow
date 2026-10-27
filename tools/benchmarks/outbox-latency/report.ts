export interface Summary {
  readonly average: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly max: number;
}

export interface LoadResult {
  readonly description: string;
  // COMMIT acknowledged → first publish call, per event.
  readonly pickupMs: Summary;
  // Load start → last event accepted by the broker.
  readonly drainMs: number;
  readonly publishCalls: number;
  // UnitOfWork.run() duration, per transaction.
  readonly runMs: Summary;
  // COMMIT acknowledged → UnitOfWork.run() resolved, per transaction.
  readonly afterCommitUs: Summary;
  readonly published: boolean;
}

export interface Report {
  readonly brokerDescription: string;
  readonly idleCheckoutsPerSecond: number;
  readonly results: readonly LoadResult[];
}

export function summarize(values: readonly number[]): Summary {
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (p: number) =>
    sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
  return {
    average: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
    max: sorted[sorted.length - 1],
  };
}

interface Column {
  readonly header: string;
  readonly value: (result: LoadResult) => string;
}

const decimal = (value: number) => value.toFixed(1);

const columns: readonly Column[] = [
  { header: 'Load', value: (result) => result.description },
  {
    header: 'Pickup avg (ms)',
    value: (result) => decimal(result.pickupMs.average),
  },
  {
    header: 'Pickup p50 (ms)',
    value: (result) => decimal(result.pickupMs.p50),
  },
  {
    header: 'Pickup p95 (ms)',
    value: (result) => decimal(result.pickupMs.p95),
  },
  {
    header: 'Pickup p99 (ms)',
    value: (result) => decimal(result.pickupMs.p99),
  },
  {
    header: 'Pickup max (ms)',
    value: (result) => decimal(result.pickupMs.max),
  },
  {
    header: 'Drain (s)',
    value: (result) => (result.drainMs / 1_000).toFixed(2),
  },
  { header: 'Publish calls', value: (result) => String(result.publishCalls) },
  { header: 'run() p50 (ms)', value: (result) => decimal(result.runMs.p50) },
  { header: 'run() p99 (ms)', value: (result) => decimal(result.runMs.p99) },
  {
    header: 'After commit p99 (µs)',
    value: (result) => decimal(result.afterCommitUs.p99),
  },
  {
    header: 'Published',
    value: (result) => (result.published ? 'all' : 'TIMED OUT'),
  },
];

export function printReport(report: Report): void {
  console.log(`Broker: ${report.brokerDescription}`);
  console.log(
    `Idle: ${report.idleCheckoutsPerSecond.toFixed(1)} database calls/s (connection checkouts: one per query outside a transaction, one per transaction)`,
  );
  console.log('Pickup: COMMIT acknowledged → first publish call of each event');
  console.log('Drain: load start → last event accepted by the broker\n');

  const rows = [
    columns.map((column) => column.header),
    ...report.results.map((result) =>
      columns.map((column) => column.value(result)),
    ),
  ];
  const widths = columns.map((_, index) =>
    Math.max(...rows.map((row) => row[index].length)),
  );
  for (const row of rows) {
    console.log(
      row
        .map((cell, index) =>
          index === 0
            ? cell.padEnd(widths[index])
            : cell.padStart(widths[index]),
        )
        .join('  '),
    );
  }
}
