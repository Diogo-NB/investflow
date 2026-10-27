import 'reflect-metadata';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { config } from 'dotenv';
import { Pool } from 'pg';
import {
  DomainEvent,
  DomainEventRecorder,
  generateUuid,
  UtcInstant,
} from '@investflow/shared-domain';
import {
  ClockModule,
  MessageBroker,
  OutboxModule,
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
import {
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
// Skips the poll that starts with the app and puts the idle window half a
// second off the poller's 1-second loop, so whole seconds hold whole polls.
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

// The testing module is the only way to swap the broker OutboxModule
// provides without changing it for the benchmark.
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
      factory: (config: ConfigService) =>
        TimedMessageBroker.create(options, config),
      inject: [ConfigService],
    })
    .compile();
  app.useLogger(['error', 'warn']);
  return app;
}

async function runBenchmark(options: BenchmarkOptions): Promise<Report> {
  const app = await createBenchmarkApp(options);
  const prisma = app.get(PrismaService);
  try {
    await removeBenchmarkEvents(prisma);
    await ensureOutboxIsDrained(prisma);
    await app.init();
    await sleep(IDLE_WARM_UP_MS);

    const idleCheckoutsPerSecond = await measureIdleCheckouts(options.idleMs);
    const broker = app.get<TimedMessageBroker>(MessageBroker, {
      strict: false,
    });
    const results: LoadResult[] = [];
    for (const name of options.loads) {
      const writer = new TransactionWriter(
        app.get(UnitOfWork),
        app.get(DomainEventRecorder),
      );
      results.push(
        await measureLoad(createLoad(name, options), writer, broker, options),
      );
    }

    return {
      brokerDescription:
        options.broker === 'floci'
          ? 'Floci'
          : `simulated, ${options.rttMs} ms ±30% per call`,
      idleCheckoutsPerSecond,
      results,
    };
  } finally {
    await removeBenchmarkEvents(prisma);
    await app.close();
  }
}

async function measureLoad(
  load: Load,
  writer: TransactionWriter,
  broker: TimedMessageBroker,
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
  config();
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
  if (!process.env['DATABASE_URL']?.trim()) {
    throw new Error('DATABASE_URL is required to benchmark the outbox');
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
