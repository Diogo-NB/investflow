import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import type { ExperimentTarget } from '@investflow/shared-infrastructure';
import type { ApiProcess } from './api-process';
import type { ExperimentOptions } from './experiment-options';
import type { ExperimentQueues } from './experiment-queues';
import type { InvestflowApiClient } from './investflow-api-client';
import {
  EExperimentStage,
  type JudgedSimulation,
  type StagedSample,
  type StageSummary,
  summarize,
  writeSimulations,
  writeTimeline,
} from './report';
import {
  EOfferRole,
  populateScenario,
  type ScenarioPopulation,
  targetRemunerationChanges,
} from './scenario-population';
import { type Scenario, setupSwitches } from './scenarios';
import type { StageObservation, StageObserver } from './stage-observer';

// Setup has no switch on, so nothing is retried and a short quiet period
// is enough to see the calculations finish.
const SETUP_QUIET_MS = 10_000;
// Long enough for the relay to publish the first change before the second
// commits, so the two are separate messages with the fault on the first.
const CHANGE_GAP_MS = 2_000;
const TARGET_EVENT_TYPE = 'OfferTermsChanged';

export interface ExperimentRunInput {
  readonly scenario: Scenario;
  readonly run: number;
  readonly batchLabel: string;
}

// One run of a scenario: create and calculate a population with no switch
// on, restart the API with the scenario's switches, change the target offer
// twice, and judge once settled; then, for scenarios with a restored stage,
// restart again and judge once more.
export class ExperimentRun {
  constructor(
    private readonly options: ExperimentOptions,
    private readonly api: ApiProcess,
    private readonly client: InvestflowApiClient,
    private readonly queues: ExperimentQueues,
    private readonly observer: StageObserver,
  ) {}

  async execute({
    scenario,
    run,
    batchLabel,
  }: ExperimentRunInput): Promise<StageSummary[]> {
    const runDirectory = join(
      this.options.outputDirectory,
      `${batchLabel}-${scenario.name}-run${run}`,
    );
    mkdirSync(runDirectory, { recursive: true });
    const logPath = join(runDirectory, 'api.log');
    const log = (message: string) =>
      console.log(`[${scenario.name} run ${run}] ${message}`);

    const summaries: StageSummary[] = [];
    const simulations: JudgedSimulation[] = [];
    const timeline: StagedSample[] = [];
    let population: ScenarioPopulation | null = null;
    const record = (
      stage: EExperimentStage,
      observation: StageObservation,
      movedMessages: number,
    ) => {
      if (!population) return;
      const roles = offerRoles(population);
      simulations.push(
        ...observation.judgements.map((judgement) => ({
          stage,
          offerRole: roles.get(judgement.simulationId) ?? EOfferRole.UNTOUCHED,
          judgement,
        })),
      );
      timeline.push(
        ...observation.timeline.map((sample) => ({ stage, sample })),
      );
      const summary: StageSummary = {
        scenario: scenario.name,
        run,
        stage,
        isSettled: observation.isSettled,
        settledAfterMs: observation.settledAfterMs,
        ...summarize(observation.judgements),
        deadLetteredAggregates: observation.deadLetteredAggregateIds.size,
        movedMessages,
        runDirectory,
      };
      summaries.push(summary);
      log(
        `${stage}: ${observation.isSettled ? 'settled' : 'TIMED OUT'} after ${(
          observation.settledAfterMs / 1_000
        ).toFixed(0)} s, ${JSON.stringify(summary.verdicts)}`,
      );
    };

    try {
      await this.api.assertStopped();
      const drained = await this.queues.drainDeadLetterQueues();
      await this.api.start(setupSwitches, null, runDirectory, logPath);
      log(`creating ${this.options.simulations} simulations`);
      population = await populateScenario(
        this.client,
        `${batchLabel} ${scenario.name} ${run}`,
        this.options.simulations,
        // The same seed for run k of every scenario, so scenarios compare
        // on equal data.
        this.options.seed + run - 1,
      );
      record(
        EExperimentStage.SETUP,
        await this.observe(population, SETUP_QUIET_MS),
        drained,
      );

      await this.api.stop();
      const leftovers = await this.queues.drainDeadLetterQueues();
      const target: ExperimentTarget = {
        aggregateId: population.targetOffer.offerId,
        eventType: TARGET_EVENT_TYPE,
        ordinal: 1,
      };
      await this.api.start(scenario.faulted, target, runDirectory, logPath);
      for (const [position, terms] of targetRemunerationChanges.entries()) {
        if (position > 0) await sleep(CHANGE_GAP_MS);
        await this.client.changeOfferRemuneration(
          population.targetOffer.offerId,
          terms,
        );
      }
      log('target offer changed; observing the faulted stage');
      record(
        EExperimentStage.FAULTED,
        await this.observe(population, this.options.quietMs),
        leftovers,
      );

      if (scenario.restored) {
        await this.api.stop();
        await this.api.start(
          scenario.restored.switches,
          null,
          runDirectory,
          logPath,
        );
        const redriven = scenario.restored.isDeadLetterRedriven
          ? await this.queues.redriveDeadLetterQueues()
          : 0;
        log(`restored the API, redrove ${redriven} messages`);
        record(
          EExperimentStage.RESTORED,
          await this.observe(population, this.options.quietMs),
          redriven,
        );
      }
    } finally {
      await this.api.stop();
      writeSimulations(join(runDirectory, 'simulations.csv'), simulations);
      writeTimeline(join(runDirectory, 'timeline.csv'), timeline);
    }
    return summaries;
  }

  private observe(
    population: ScenarioPopulation,
    quietMs: number,
  ): Promise<StageObservation> {
    return this.observer.observe(
      population.simulationIds,
      population.targetOffer.simulationIds,
      {
        quietMs,
        sampleMs: this.options.sampleMs,
        timeoutMs: this.options.timeoutMs,
      },
    );
  }
}

function offerRoles(population: ScenarioPopulation): Map<string, EOfferRole> {
  return new Map(
    population.offers.flatMap(({ role, simulationIds }) =>
      simulationIds.map((id) => [id, role] as const),
    ),
  );
}
