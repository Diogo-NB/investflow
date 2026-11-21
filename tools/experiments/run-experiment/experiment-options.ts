import { parseArgs } from 'node:util';
import { scenarioNames } from './scenarios';

export interface ExperimentOptions {
  readonly scenarios: readonly string[];
  readonly runs: number;
  readonly simulations: number;
  readonly seed: number;
  readonly envFile: string;
  readonly quietMs: number;
  readonly sampleMs: number;
  readonly timeoutMs: number;
  readonly outputDirectory: string;
}

export const usage = `Usage: pnpm experiment:run [options]

  --scenarios <list>  Comma-separated scenario names, or all (all)
  --runs <n>          Runs of each scenario (3)
  --simulations <n>   Simulations created for each run (1000)
  --seed <n>          Seed of the generated population; equal seeds create equal data (1)
  --env-file <path>   Environment of the runner and the API it starts (.env)
  --quiet-s <n>       Seconds with no change before a run counts as settled (60)
  --sample-s <n>      Seconds between samples of the affected simulations (5)
  --timeout-s <n>     Seconds a run may take to settle before it is judged anyway (1200)
  --out <dir>         Where each run's CSV files and API logs are written (tmp/experiments)
  --help              Show this help

Scenarios:
${scenarioNames.map((name) => `  ${name}`).join('\n')}

Build the API first (pnpm experiment:run does) and stop any API already
running: the runner starts and stops its own. Against Floci, run it without
a shell AWS_PROFILE (env -u AWS_PROFILE), since .env holds Floci's key pair.`;

function positiveInteger(name: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`--${name} must be a positive integer.\n\n${usage}`);
  }
  return parsed;
}

// Null when --help was asked for.
export function parseExperimentOptions(
  args: readonly string[],
): ExperimentOptions | null {
  const { values } = parseArgs({
    args: [...args],
    options: {
      scenarios: { type: 'string', default: 'all' },
      runs: { type: 'string', default: '3' },
      simulations: { type: 'string', default: '1000' },
      seed: { type: 'string', default: '1' },
      'env-file': { type: 'string', default: '.env' },
      'quiet-s': { type: 'string', default: '60' },
      'sample-s': { type: 'string', default: '5' },
      'timeout-s': { type: 'string', default: '1200' },
      out: { type: 'string', default: 'tmp/experiments' },
      help: { type: 'boolean', default: false },
    },
    strict: true,
  });
  if (values.help) return null;

  const scenarios =
    values.scenarios === 'all'
      ? scenarioNames
      : values.scenarios.split(',').map((name) => name.trim());
  const unknown = scenarios.filter((name) => !scenarioNames.includes(name));
  if (unknown.length > 0) {
    throw new Error(`Unknown scenarios: ${unknown.join(', ')}\n\n${usage}`);
  }
  return {
    scenarios,
    runs: positiveInteger('runs', values.runs),
    simulations: positiveInteger('simulations', values.simulations),
    seed: positiveInteger('seed', values.seed),
    envFile: values['env-file'],
    quietMs: positiveInteger('quiet-s', values['quiet-s']) * 1_000,
    sampleMs: positiveInteger('sample-s', values['sample-s']) * 1_000,
    timeoutMs: positiveInteger('timeout-s', values['timeout-s']) * 1_000,
    outputDirectory: values.out,
  };
}
