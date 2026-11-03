import 'reflect-metadata';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  CreateCurveCommand,
  CreateCurveUseCase,
} from '@investflow/investment-simulator-application';
import { CurvesModule } from '@investflow/investment-simulator-infrastructure';
import {
  ClockModule,
  PrismaModule,
  PrismaService,
  UnitOfWork,
} from '@investflow/shared-infrastructure';
import { bcbSystemCurves } from './bcb-system-curves';

const USAGE = `Usage: node load-bcb-system-curves.js [--commit]

Creates the CDI and SELIC system curves. Without --commit it applies the domain
rules and writes the curves, then rolls back before the outbox rows are written.`;

// Without authentication, HTTP, consumers, or the outbox poller: the running
// API's poller publishes the events this records.
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ClockModule,
    PrismaModule,
  ],
  exports: [ClockModule],
})
class LoadInfrastructureModule {}

@Module({ imports: [LoadInfrastructureModule, CurvesModule] })
class LoadBcbSystemCurvesModule {}

class DryRunRollback extends Error {}

function parseOptions(args: readonly string[]): { isCommit: boolean } {
  const unknown = args.filter((arg) => arg !== '--commit');
  if (unknown.length > 0) throw new Error(`${unknown.join(' ')}\n\n${USAGE}`);
  return { isCommit: args.includes('--commit') };
}

async function main(): Promise<void> {
  const { isCommit } = parseOptions(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(
    LoadBcbSystemCurvesModule,
    { logger: ['error', 'warn'] },
  );
  try {
    const existing = await app.get(PrismaService).client.curve.findMany({
      where: {
        ownerId: null,
        deletedAt: null,
        name: { in: bcbSystemCurves.map((curve) => curve.name) },
      },
      select: { name: true },
    });
    if (existing.length > 0) {
      const names = existing.map((curve) => curve.name).join(', ');
      throw new Error(
        `System curves already exist: ${names}. Nothing written.`,
      );
    }

    const createCurve = app.get(CreateCurveUseCase);
    // One unit of work, so a failure leaves neither curve behind.
    await app.get(UnitOfWork).run(async () => {
      for (const curve of bcbSystemCurves) {
        const result = await createCurve.execute(
          CreateCurveCommand.fromRequest(null, curve),
        );
        if (result.isErr()) throw result.error;
        const { startDate } = curve.intervals[0];
        const { endDate } = curve.intervals[curve.intervals.length - 1];
        console.log(
          `${curve.name}: ${curve.intervals.length} intervals, ${startDate} to ${endDate}`,
        );
      }
      if (!isCommit) throw new DryRunRollback();
    });
    console.log('Committed.');
  } catch (error) {
    if (!(error instanceof DryRunRollback)) throw error;
    console.log('Dry run: rolled back. Pass --commit to write.');
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error('Loading the BCB system curves failed:', error);
  process.exitCode = 1;
});
