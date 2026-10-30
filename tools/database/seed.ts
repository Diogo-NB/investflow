import 'reflect-metadata';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { config } from 'dotenv';
import {
  CreateCurveCommand,
  CreateCurveUseCase,
  CreateOfferCommand,
  CreateOfferUseCase,
} from '@investflow/investment-simulator-application';
import {
  EEconomicIndex,
  ETitleType,
} from '@investflow/investment-simulator-domain';
import {
  CurvesModule,
  OffersModule,
} from '@investflow/investment-simulator-infrastructure';
import { AppError, Result } from '@investflow/shared-domain';
import {
  ClockModule,
  PrismaModule,
  PrismaService,
  UnitOfWork,
} from '@investflow/shared-infrastructure';
import { curveRange, curves, offers } from './investment-simulator/fixtures';

// Provides what the host normally makes global, without authentication,
// HTTP, or the outbox poller.
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ClockModule,
    PrismaModule,
  ],
  exports: [ClockModule],
})
class SeedInfrastructureModule {}

@Module({ imports: [SeedInfrastructureModule, CurvesModule, OffersModule] })
class SeedModule {}

// System offers and curves go through the use cases with the system actor, so
// they obey the domain rules and raise their events. Existing ones, matched by
// the terms that identify an offer or by a curve's name, are left untouched.
async function seedSystemContent(): Promise<{
  offers: number;
  curves: number;
}> {
  const app = await NestFactory.createApplicationContext(SeedModule, {
    logger: ['error', 'warn'],
  });
  try {
    const prisma = app.get(PrismaService);
    const createOffer = app.get(CreateOfferUseCase);
    const createCurve = app.get(CreateCurveUseCase);
    const unitOfWork = app.get(UnitOfWork);
    const run = (execute: () => Promise<Result<unknown, AppError>>) =>
      unitOfWork.run(async () => {
        const result = await execute();
        if (result.isErr()) throw result.error;
      });

    let offersCreated = 0;
    for (const offer of offers) {
      const existing = await prisma.client.offer.findFirst({
        where: {
          ownerId: null,
          titleType: offer.titleType,
          issuerName: offer.issuerName,
          maturityDate: new Date(offer.maturityDate),
          remunerationType: offer.remunerationTerms.kind,
          rateValue: offer.remunerationTerms.rate,
          deletedAt: null,
        },
      });
      if (existing) continue;

      const command = CreateOfferCommand.fromRequest(null, {
        ...offer,
        titleType: offer.titleType as ETitleType,
      });
      await run(() => createOffer.execute(command));
      offersCreated++;
    }

    let curvesCreated = 0;
    for (const curve of curves) {
      const existing = await prisma.client.curve.findFirst({
        where: {
          ownerId: null,
          index: curve.index,
          name: curve.name,
          deletedAt: null,
        },
      });
      if (existing) continue;

      const command = CreateCurveCommand.fromRequest(null, {
        index: curve.index as EEconomicIndex,
        name: curve.name,
        description: curve.description,
        intervals: [{ ...curveRange, value: curve.value }],
      });
      await run(() => createCurve.execute(command));
      curvesCreated++;
    }
    return { offers: offersCreated, curves: curvesCreated };
  } finally {
    await app.close();
  }
}

async function main(): Promise<void> {
  config();
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString?.trim()) {
    throw new Error('DATABASE_URL is required to seed the local database');
  }

  const created = await seedSystemContent();
  console.log(
    `Seeded ${created.offers} of ${offers.length} system offers and ${created.curves} of ${curves.length} system curves for 2024–2028.`,
  );
}

main().catch((error: unknown) => {
  console.error('Database seed failed:', error);
  process.exitCode = 1;
});
