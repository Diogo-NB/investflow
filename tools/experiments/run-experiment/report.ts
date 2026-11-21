import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import type { ExperimentOptions } from './experiment-options';
import type { EOfferRole } from './scenario-population';
import type { SimulationJudgement } from './simulation-result-oracle';
import {
  countVerdicts,
  type TimelineSample,
  type VerdictCounts,
} from './stage-observer';

export enum EExperimentStage {
  // The population, calculated with no switch on.
  SETUP = 'setup',
  FAULTED = 'faulted',
  RESTORED = 'restored',
}

interface Column<T> {
  readonly header: string;
  readonly of: (row: T) => string | number | boolean;
}

export interface JudgedSimulation {
  readonly stage: EExperimentStage;
  readonly offerRole: EOfferRole;
  readonly judgement: SimulationJudgement;
}

export interface StagedSample {
  readonly stage: EExperimentStage;
  readonly sample: TimelineSample;
}

export interface StageSummary {
  readonly scenario: string;
  readonly run: number;
  readonly stage: EExperimentStage;
  readonly isSettled: boolean;
  readonly settledAfterMs: number;
  readonly simulations: number;
  readonly verdicts: VerdictCounts;
  readonly deadLetteredAggregates: number;
  // Messages moved before the stage: drained before the setup, redriven
  // before a restored stage.
  readonly movedMessages: number;
  readonly runDirectory: string;
}

const verdictColumns = <T>(
  of: (row: T) => VerdictCounts,
): readonly Column<T>[] => [
  { header: 'correct', of: (row) => of(row)['correct'] },
  { header: 'wrong_alarmed', of: (row) => of(row)['wrong-alarmed'] },
  { header: 'wrong_visible', of: (row) => of(row)['wrong-visible'] },
  { header: 'wrong_silent', of: (row) => of(row)['wrong-silent'] },
];

const simulationColumns: readonly Column<JudgedSimulation>[] = [
  { header: 'stage', of: (row) => row.stage },
  { header: 'simulation_id', of: (row) => row.judgement.simulationId },
  { header: 'offer_role', of: (row) => row.offerRole },
  { header: 'verdict', of: (row) => row.judgement.verdict },
  { header: 'status', of: (row) => row.judgement.status },
  { header: 'is_settled', of: (row) => row.judgement.isSettled },
  { header: 'is_dead_lettered', of: (row) => row.judgement.isDeadLettered },
  { header: 'reference_kind', of: (row) => row.judgement.referenceKind },
  {
    header: 'divergent_fields',
    of: (row) => row.judgement.divergentFields.join('|'),
  },
  {
    header: 'result_input_fingerprint',
    of: (row) => row.judgement.resultInputFingerprint ?? '',
  },
  {
    header: 'current_input_fingerprint',
    of: (row) => row.judgement.currentInputFingerprint,
  },
];

const timelineColumns: readonly Column<StagedSample>[] = [
  { header: 'stage', of: (row) => row.stage },
  {
    header: 'elapsed_s',
    of: (row) => (row.sample.elapsedMs / 1_000).toFixed(1),
  },
  ...verdictColumns<StagedSample>((row) => row.sample.verdicts),
  { header: 'pending_simulations', of: (row) => row.sample.pendingSimulations },
  { header: 'unpublished_events', of: (row) => row.sample.unpublishedEvents },
  { header: 'queued_messages', of: (row) => row.sample.queuedMessages },
  {
    header: 'dead_lettered_messages',
    of: (row) => row.sample.deadLetteredMessages,
  },
];

const summaryColumns: readonly Column<StageSummary>[] = [
  { header: 'scenario', of: (row) => row.scenario },
  { header: 'run', of: (row) => row.run },
  { header: 'stage', of: (row) => row.stage },
  { header: 'is_settled', of: (row) => row.isSettled },
  {
    header: 'settled_after_s',
    of: (row) => (row.settledAfterMs / 1_000).toFixed(0),
  },
  { header: 'simulations', of: (row) => row.simulations },
  ...verdictColumns<StageSummary>((row) => row.verdicts),
  {
    header: 'dead_lettered_aggregates',
    of: (row) => row.deadLetteredAggregates,
  },
  { header: 'moved_messages', of: (row) => row.movedMessages },
  { header: 'run_directory', of: (row) => row.runDirectory },
];

function csvLine<T>(columns: readonly Column<T>[], row: T): string {
  return columns.map((column) => csvField(column.of(row))).join(',');
}

function csvField(value: string | number | boolean): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv<T>(columns: readonly Column<T>[], rows: readonly T[]): string {
  return [
    columns.map(({ header }) => header).join(','),
    ...rows.map((row) => csvLine(columns, row)),
  ].join('\n');
}

export function writeSimulations(
  path: string,
  rows: readonly JudgedSimulation[],
): void {
  writeFileSync(path, `${csv(simulationColumns, rows)}\n`);
}

export function writeTimeline(
  path: string,
  rows: readonly StagedSample[],
): void {
  writeFileSync(path, `${csv(timelineColumns, rows)}\n`);
}

// Appends, so an interrupted batch keeps the stages it finished.
export function appendSummary(path: string, row: StageSummary): void {
  if (!existsSync(path)) {
    writeFileSync(
      path,
      `${summaryColumns.map(({ header }) => header).join(',')}\n`,
    );
  }
  appendFileSync(path, `${csvLine(summaryColumns, row)}\n`);
}

export function summarize(
  judgements: readonly SimulationJudgement[],
): Pick<StageSummary, 'simulations' | 'verdicts'> {
  return {
    simulations: judgements.length,
    verdicts: countVerdicts(judgements),
  };
}

export function printSummary(rows: readonly StageSummary[]): void {
  console.table(
    rows.map((row) =>
      Object.fromEntries(
        summaryColumns
          .filter(({ header }) => header !== 'run_directory')
          .map((column) => [column.header, column.of(row)]),
      ),
    ),
  );
}

const BASELINE_SCENARIO = 'baseline';

export interface BatchReport {
  readonly batch: string;
  readonly options: ExperimentOptions;
  // What makes a stage's verdicts unusable, not whether a hypothesis held.
  readonly problems: readonly string[];
  readonly stages: readonly StageSummary[];
}

export function problemsOf(summaries: readonly StageSummary[]): string[] {
  return summaries.flatMap((summary) => {
    const name = `${summary.scenario} run ${summary.run} ${summary.stage}`;
    const problems: string[] = [];
    if (!summary.isSettled) {
      problems.push(`${name} did not settle and was judged at the timeout`);
    }
    const isAllCorrect = summary.verdicts.correct === summary.simulations;
    if (summary.stage === EExperimentStage.SETUP && !isAllCorrect) {
      problems.push(`${name} has wrong results before any switch was on`);
    }
    // The baseline turns nothing on, so a wrong result there is a defect of
    // the runner, the oracle, or the system, not a finding about a fault.
    if (summary.scenario === BASELINE_SCENARIO && !isAllCorrect) {
      problems.push(`${name} has wrong results with no fault injected`);
    }
    return problems;
  });
}

// Rewritten after every run, so an interrupted batch keeps what it finished.
export function writeBatchReport(path: string, report: BatchReport): void {
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
}
