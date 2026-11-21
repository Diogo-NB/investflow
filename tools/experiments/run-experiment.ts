import 'reflect-metadata';
import { join } from 'node:path';
import { SQSClient } from '@aws-sdk/client-sqs';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  CurveRepository,
  OfferRepository,
  SimulationRepository,
} from '@investflow/investment-simulator-application';
import { SimulationCalculationService } from '@investflow/investment-simulator-domain';
import { SimulationReferenceModule } from '@investflow/investment-simulator-infrastructure';
import { Clock } from '@investflow/shared-application';
import {
  type AwsConfig,
  awsConfig,
  ClockModule,
  type KeycloakConfig,
  keycloakConfig,
  PrismaModule,
  PrismaService,
} from '@investflow/shared-infrastructure';
import { ApiProcess } from './run-experiment/api-process';
import {
  parseExperimentOptions,
  usage,
} from './run-experiment/experiment-options';
import { ExperimentQueues } from './run-experiment/experiment-queues';
import { ExperimentRun } from './run-experiment/experiment-run';
import {
  type ExperimentRunnerConfig,
  experimentRunnerConfig,
} from './run-experiment/experiment-runner.config';
import { InvestflowApiClient } from './run-experiment/investflow-api-client';
import {
  appendSummary,
  printSummary,
  problemsOf,
  type StageSummary,
  writeBatchReport,
} from './run-experiment/report';
import { scenarios } from './run-experiment/scenarios';
import { SimulationResultOracle } from './run-experiment/simulation-result-oracle';
import { StageObserver } from './run-experiment/stage-observer';

// The environment comes from --env-file, loaded before Nest starts, and is
// what the started API inherits too.
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
    ClockModule,
    PrismaModule,
  ],
  exports: [ClockModule],
})
class ExperimentInfrastructureModule {}

@Module({
  imports: [
    ExperimentInfrastructureModule,
    SimulationReferenceModule,
    ConfigModule.forFeature(experimentRunnerConfig),
    ConfigModule.forFeature(keycloakConfig),
    ConfigModule.forFeature(awsConfig),
  ],
})
class ExperimentRunnerModule {}

async function main(): Promise<void> {
  const options = parseExperimentOptions(process.argv.slice(2));
  if (!options) {
    console.log(usage);
    return;
  }
  process.loadEnvFile(options.envFile);

  const app = await NestFactory.createApplicationContext(
    ExperimentRunnerModule,
    { logger: ['error', 'warn'] },
  );
  try {
    const runner = app.get<ExperimentRunnerConfig>(experimentRunnerConfig.KEY);
    const aws = app.get<AwsConfig>(awsConfig.KEY);
    const queues = new ExperimentQueues(
      new SQSClient({ region: aws.region }),
      runner,
    );
    const oracle = new SimulationResultOracle(
      app.get(SimulationRepository),
      app.get(OfferRepository),
      app.get(CurveRepository),
      app.get(SimulationCalculationService),
    );
    const experimentRun = new ExperimentRun(
      options,
      new ApiProcess(runner.apiUrl, options.variant),
      new InvestflowApiClient(
        runner,
        app.get<KeycloakConfig>(keycloakConfig.KEY),
      ),
      queues,
      new StageObserver(app.get(PrismaService), queues, oracle, app.get(Clock)),
    );

    const batchLabel = `${new Date().toISOString().replace(/[:.]/g, '-')}-${options.variant}`;
    const summaryPath = join(
      options.outputDirectory,
      `${batchLabel}-summary.csv`,
    );
    const reportPath = join(
      options.outputDirectory,
      `${batchLabel}-report.json`,
    );
    const summaries: StageSummary[] = [];
    for (const scenario of scenarios.filter(({ name }) =>
      options.scenarios.includes(name),
    )) {
      for (let run = 1; run <= options.runs; run++) {
        for (const summary of await experimentRun.execute({
          scenario,
          run,
          batchLabel,
        })) {
          appendSummary(summaryPath, summary);
          summaries.push(summary);
        }
        writeBatchReport(reportPath, {
          batch: batchLabel,
          options,
          problems: problemsOf(summaries),
          stages: summaries,
        });
      }
    }
    printSummary(summaries);
    const problems = problemsOf(summaries);
    for (const problem of problems) console.error(`PROBLEM: ${problem}`);
    console.log(`Summary: ${summaryPath}\nReport: ${reportPath}`);
    // Lets a caller tell an unusable batch from one whose verdicts stand.
    if (problems.length > 0) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
