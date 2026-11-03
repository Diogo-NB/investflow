import 'reflect-metadata';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import {
  DomainEvent,
  DomainEventRecorder,
  generateUuid,
  UtcInstant,
} from '@investflow/shared-domain';
import {
  AwsConfig,
  awsConfig,
  ClockModule,
  EventBridgeConfig,
  eventBridgeConfig,
  MessageBroker,
  OutboxConfig,
  outboxConfig,
  OutboxModule,
  OutboxPollerService,
  PrismaModule,
  PrismaService,
  UnitOfWork,
} from '@investflow/shared-infrastructure';
import {
  BenchmarkOptions,
  parseBenchmarkOptions,
  usage,
} from './outbox-latency/benchmark-options';
import { createLoad, Load } from './outbox-latency/loads';
import { ObservedOutboxPoller } from './outbox-latency/observed-outbox-poller';
import {
  describePollerTimeline,
  LoadResult,
  printReport,
  Report,
  summarize,
} from './outbox-latency/report';
import { TimedMessageBroker } from './outbox-latency/timed-message-broker';

// Measures how long committed outbox events wait to be published, through the
// real unit of work, recorder, relay, and poller. Run it with the API stopped:
// another process's poller would publish the benchmark's events itself.

// No EventBridge rule matches this context, so nothing is delivered.
const BENCHMARK_CONTEXT = 'benchmark';
const PUBLISHED_CHECK_INTERVAL_MS = 10;
// Skips the poll that starts with the app and keeps the idle window's edges
// half a second off the poller's whole-second gaps, so polls are not split
// between the window and its surroundings.
const IDLE_WARM_UP_MS = 500;

interface CommittedTransaction {
  readonly eventIds: readonly string[];
  readonly startedAt: number;
  readonly committedAt: number;
  readonly finishedAt: number;
}

class TransactionWriter {
  readonly committed: CommittedTransaction[] = [];

  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly recorder: DomainEventRecorder,
  ) {}

  readonly write = async (events: number): Promise<void> => {
    const recorded = Array.from({ length: events }, benchmarkEvent);
    let committedAt = Number.NaN;
    const startedAt = performance.now();
    await this.unitOfWork.run(async () => {
      // Registered before the recorder's own hook, so it runs first.
      this.unitOfWork.afterCommit(() => (committedAt = performance.now()));
      this.recorder.record(...recorded);
    });
    this.committed.push({
      eventIds: recorded.map((event) => event.eventId),
      startedAt,
      committedAt,
      finishedAt: performance.now(),
    });
  };
}

function benchmarkEvent(): DomainEvent {
  return {
    eventId: generateUuid(),
    occurredAt: UtcInstant.ofEpochMilliseconds(Date.now()),
    eventType: 'BenchmarkHappened',
    version: 1,
    aggregateId: generateUuid(),
    aggregateType: 'Benchmark',
    context: BENCHMARK_CONTEXT,
  };
}

// The testing module is the only way to swap the broker and poller
// OutboxModule provides without changing them for the benchmark.
async function createBenchmarkApp(
  options: BenchmarkOptions,
): Promise<TestingModule> {
  const app = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      ClockModule,
      PrismaModule,
      OutboxModule,
    ],
  })
    .overrideProvider(MessageBroker)
    .useFactory({
      factory: (aws: AwsConfig, eventBridge: EventBridgeConfig) =>
        TimedMessageBroker.create(options, aws, eventBridge),
      inject: [awsConfig.KEY, eventBridgeConfig.KEY],
    })
    .overrideProvider(OutboxPollerService)
    .useClass(ObservedOutboxPoller)
    .compile();
  app.useLogger(['error', 'warn']);
  return app;
}

// A host without OutboxModule, like the seed: its commits reach the outbox
// but no relay, so only the benchmark app's poller publishes them.
async function createStrandedApp(): Promise<TestingModule> {
  const app = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      ClockModule,
      PrismaModule,
    ],
  }).compile();
  app.useLogger(['error', 'warn']);
  return app;
}

function describeOutbox(config: OutboxConfig): string {
  const seconds = (ms: number) => `${ms / 1_000} s`;
  return `polls every ${seconds(config.pollMinIntervalMs)}, doubling while empty up to ${seconds(config.pollMaxIntervalMs)}; retention every ${seconds(config.retentionIntervalMs)}, keeping ${config.retentionMs / 86_400_000} days`;
}

async function runBenchmark(options: BenchmarkOptions): Promise<Report> {
  const app = await createBenchmarkApp(options);
  const strandedApp = options.loads.includes('stranded')
    ? await createStrandedApp()
    : undefined;
  const prisma = app.get(PrismaService);
  try {
    await removeBenchmarkEvents(prisma);
    await ensureOutboxIsDrained(prisma);
    await strandedApp?.init();
    await app.init();
    await sleep(IDLE_WARM_UP_MS);

    const poller = app.get<ObservedOutboxPoller>(OutboxPollerService);
    const idleStartedAt = performance.now();
    const idleCheckoutsPerSecond = await measureIdleCheckouts(options.idleMs);
    const idlePollGapsS = pollGaps(
      poller,
      idleStartedAt,
      performance.now(),
    ).map(({ gapMs }) => gapMs / 1_000);
    const broker = app.get<TimedMessageBroker>(MessageBroker, {
      strict: false,
    });
    const results: LoadResult[] = [];
    for (const name of options.loads) {
      const load = createLoad(name, options);
      const host = load.isStranded && strandedApp ? strandedApp : app;
      const writer = new TransactionWriter(
        host.get(UnitOfWork),
        host.get(DomainEventRecorder),
      );
      results.push(await measureLoad(load, writer, broker, poller, options));
    }

    return {
      brokerDescription:
        options.broker === 'floci'
          ? 'Floci'
          : `simulated, ${options.rttMs} ms ±30% per call${options.rejectRate > 0 ? `, rejects ${options.rejectRate * 100}% of first calls per message` : ''}`,
      outboxDescription: describeOutbox(
        app.get<OutboxConfig>(outboxConfig.KEY),
      ),
      idleCheckoutsPerSecond,
      idlePollGapsS,
      results,
    };
  } finally {
    await removeBenchmarkEvents(prisma);
    await app.close();
    await strandedApp?.close();
  }
}

function pollGaps(
  poller: ObservedOutboxPoller,
  start: number,
  end: number,
): { gapMs: number; claimed: number }[] {
  let previous = poller.pollBefore(start)?.at;
  return poller.pollsBetween(start, end).map(({ at, claimed }) => {
    const gapMs = previous === undefined ? 0 : at - previous;
    previous = at;
    return { gapMs, claimed };
  });
}

async function measureLoad(
  load: Load,
  writer: TransactionWriter,
  broker: TimedMessageBroker,
  poller: ObservedOutboxPoller,
  options: BenchmarkOptions,
): Promise<LoadResult> {
  broker.reset();
  const startedAt = performance.now();
  await load.run(writer.write);

  const eventIds = writer.committed.flatMap(
    (transaction) => transaction.eventIds,
  );
  const published = await waitUntilAccepted(
    broker,
    eventIds,
    options.timeoutMs,
  );
  const pickupMs = writer.committed.flatMap((transaction) =>
    transaction.eventIds.map(
      (eventId) =>
        (broker.firstCallAt(eventId) ?? Number.POSITIVE_INFINITY) -
        transaction.committedAt,
    ),
  );
  const lastAcceptedAt = Math.max(
    ...eventIds.map((eventId) => broker.acceptedAt(eventId) ?? Number.NaN),
  );
  const polls = pollGaps(
    poller,
    startedAt,
    published ? lastAcceptedAt : performance.now(),
  );
  const retryWaitsMs = broker.retryWaitsMs();

  return {
    description: load.description,
    pickupMs: summarize(pickupMs),
    drainMs: lastAcceptedAt - startedAt,
    publishCalls: broker.calls,
    runMs: summarize(
      writer.committed.map(
        ({ startedAt, finishedAt }) => finishedAt - startedAt,
      ),
    ),
    afterCommitUs: summarize(
      writer.committed.map(
        ({ committedAt, finishedAt }) => (finishedAt - committedAt) * 1_000,
      ),
    ),
    polls: polls.length,
    pollerClaims: polls.reduce((sum, { claimed }) => sum + claimed, 0),
    retryWaitMaxMs:
      retryWaitsMs.length > 0 ? Math.max(...retryWaitsMs) : undefined,
    pollerTimeline: describePollerTimeline(polls),
    published,
  };
}

async function waitUntilAccepted(
  broker: TimedMessageBroker,
  eventIds: readonly string[],
  timeoutMs: number,
): Promise<boolean> {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (eventIds.every((eventId) => broker.acceptedAt(eventId) !== undefined)) {
      return true;
    }
    await sleep(PUBLISHED_CHECK_INTERVAL_MS);
  }
  return false;
}

// PrismaService keeps its pool private, so the pool's connect is wrapped for
// the measured window only. Each checkout is one query outside a
// transaction or one transaction.
async function measureIdleCheckouts(durationMs: number): Promise<number> {
  const connect = Pool.prototype.connect;
  let checkouts = 0;
  Pool.prototype.connect = function (this: Pool, ...args: unknown[]) {
    checkouts++;
    return Reflect.apply(connect, this, args);
  } as Pool['connect'];
  try {
    await sleep(durationMs);
  } finally {
    Pool.prototype.connect = connect;
  }
  return checkouts / (durationMs / 1_000);
}

// Runs before the app starts, while its poller cannot publish anything yet.
async function ensureOutboxIsDrained(prisma: PrismaService): Promise<void> {
  const unpublished = await prisma.client.outboxEvent.count({
    where: { publishedAt: null },
  });
  if (unpublished > 0) {
    throw new Error(
      `${unpublished} outbox events are unpublished; start the API until they are published, then stop it and benchmark again`,
    );
  }
}

async function removeBenchmarkEvents(prisma: PrismaService): Promise<void> {
  await prisma.client.outboxEvent.deleteMany({
    where: { context: BENCHMARK_CONTEXT },
  });
}

async function main(): Promise<void> {
  let options: BenchmarkOptions | undefined;
  try {
    options = parseBenchmarkOptions(process.argv.slice(2));
  } catch (error) {
    console.error(
      `${error instanceof Error ? error.message : error}\n\n${usage}`,
    );
    process.exitCode = 1;
    return;
  }
  if (!options) {
    console.log(usage);
    return;
  }
  const report = await runBenchmark(options);
  printReport(report);
  if (report.results.some((result) => !result.published)) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error('Outbox benchmark failed:', error);
  process.exitCode = 1;
});
