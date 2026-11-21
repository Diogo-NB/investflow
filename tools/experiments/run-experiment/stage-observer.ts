import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import type { Clock } from '@investflow/shared-application';
import type { PrismaService } from '@investflow/shared-infrastructure';
import type { ExperimentQueues } from './experiment-queues';
import {
  ESimulationVerdict,
  type SimulationJudgement,
  type SimulationResultOracle,
} from './simulation-result-oracle';

export type VerdictCounts = Record<ESimulationVerdict, number>;

export interface TimelineSample {
  readonly elapsedMs: number;
  // Of the affected simulations only.
  readonly verdicts: VerdictCounts;
  readonly pendingSimulations: number;
  readonly unpublishedEvents: number;
  readonly queuedMessages: number;
  readonly deadLetteredMessages: number;
}

export interface StageObservation {
  // False when the stage was judged at the timeout instead.
  readonly isSettled: boolean;
  readonly settledAfterMs: number;
  readonly timeline: readonly TimelineSample[];
  readonly judgements: readonly SimulationJudgement[];
  readonly deadLetteredAggregateIds: ReadonlySet<string>;
}

export interface StageObservationTiming {
  readonly quietMs: number;
  readonly sampleMs: number;
  readonly timeoutMs: number;
}

interface SystemSnapshot {
  readonly unpublishedEvents: number;
  readonly queuedMessages: number;
  readonly deadLetteredMessages: number;
  readonly pendingSimulations: number;
  // Of every run simulation's status, revision, and fingerprint.
  readonly calculationsDigest: string;
}

export function countVerdicts(
  judgements: readonly SimulationJudgement[],
): VerdictCounts {
  const counts = Object.fromEntries(
    Object.values(ESimulationVerdict).map((verdict) => [verdict, 0]),
  ) as VerdictCounts;
  for (const { verdict } of judgements) counts[verdict]++;
  return counts;
}

// Samples a stage until the system has settled, then judges every run
// simulation. Settled means nothing is left to deliver (no unpublished
// event, no message in a consumed queue, no pending simulation) and nothing
// changed for the quiet period, which outlasts a redelivery's visibility
// timeout.
export class StageObserver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queues: ExperimentQueues,
    private readonly oracle: SimulationResultOracle,
    private readonly clock: Clock,
  ) {}

  async observe(
    simulationIds: readonly string[],
    affectedSimulationIds: readonly string[],
    { quietMs, sampleMs, timeoutMs }: StageObservationTiming,
  ): Promise<StageObservation> {
    const startedAt = Date.now();
    const timeline: TimelineSample[] = [];
    let previous: SystemSnapshot | null = null;
    let unchangedSince = startedAt;
    let isSettled = false;

    while (Date.now() - startedAt < timeoutMs) {
      const sampledAt = Date.now();
      const snapshot = await this.snapshot(simulationIds);
      const deadLettered = await this.queues.deadLetteredAggregateIds();
      const affected = await this.oracle.judge(
        affectedSimulationIds,
        deadLettered,
        this.clock.now(),
      );
      timeline.push({
        elapsedMs: sampledAt - startedAt,
        verdicts: countVerdicts(affected),
        pendingSimulations: snapshot.pendingSimulations,
        unpublishedEvents: snapshot.unpublishedEvents,
        queuedMessages: snapshot.queuedMessages,
        deadLetteredMessages: snapshot.deadLetteredMessages,
      });

      if (!previous || !isSameSnapshot(previous, snapshot)) {
        unchangedSince = sampledAt;
      }
      previous = snapshot;
      if (isDrained(snapshot) && sampledAt - unchangedSince >= quietMs) {
        isSettled = true;
        break;
      }
      await sleep(Math.max(0, sampledAt + sampleMs - Date.now()));
    }

    const deadLetteredAggregateIds =
      await this.queues.deadLetteredAggregateIds();
    return {
      isSettled,
      settledAfterMs: Date.now() - startedAt,
      timeline,
      judgements: await this.oracle.judge(
        simulationIds,
        deadLetteredAggregateIds,
        this.clock.now(),
      ),
      deadLetteredAggregateIds,
    };
  }

  private async snapshot(
    simulationIds: readonly string[],
  ): Promise<SystemSnapshot> {
    const [unpublishedEvents, calculations, queueCounts] = await Promise.all([
      this.prisma.client.outboxEvent.count({ where: { publishedAt: null } }),
      this.prisma.client.simulationCalculation.findMany({
        where: { simulationId: { in: [...simulationIds] } },
        select: {
          simulationId: true,
          status: true,
          simulationRevision: true,
          inputFingerprint: true,
        },
        orderBy: { simulationId: 'asc' },
      }),
      this.queues.counts(),
    ]);
    const digest = createHash('sha256');
    for (const calculation of calculations) {
      digest.update(
        `${calculation.simulationId}:${calculation.status}:${calculation.simulationRevision}:${calculation.inputFingerprint ?? ''};`,
      );
    }
    return {
      unpublishedEvents,
      queuedMessages: queueCounts.queued,
      deadLetteredMessages: queueCounts.deadLettered,
      pendingSimulations: calculations.filter(
        ({ status }) => status === 'PENDING',
      ).length,
      calculationsDigest: digest.digest('hex'),
    };
  }
}

function isDrained(snapshot: SystemSnapshot): boolean {
  return (
    snapshot.unpublishedEvents === 0 &&
    snapshot.queuedMessages === 0 &&
    snapshot.pendingSimulations === 0
  );
}

function isSameSnapshot(a: SystemSnapshot, b: SystemSnapshot): boolean {
  return (
    a.unpublishedEvents === b.unpublishedEvents &&
    a.queuedMessages === b.queuedMessages &&
    a.deadLetteredMessages === b.deadLetteredMessages &&
    a.pendingSimulations === b.pendingSimulations &&
    a.calculationsDigest === b.calculationsDigest
  );
}
