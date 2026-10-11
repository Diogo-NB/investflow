import 'reflect-metadata';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { Pool } from 'pg';
import {
  CreateCurveCommand,
  CreateCurveUseCase,
} from '@investflow/investment-simulator-application';
import { EEconomicIndex } from '@investflow/investment-simulator-domain';
import { CurvesModule } from '@investflow/investment-simulator-infrastructure';
import {
  ClockModule,
  PrismaModule,
  PrismaService,
  TransactionContext,
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

@Module({ imports: [SeedInfrastructureModule, CurvesModule] })
class SeedModule {}

async function seedOffers(connectionString: string): Promise<void> {
  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    await prisma.$transaction(async (tx) => {
      for (const offer of offers) {
        const existingOffer = await tx.investmentOffer.findFirst({
          where: {
            issuerName: offer.issuerName,
            titleType: offer.titleType,
            redemptionType: offer.redemptionType,
            remunerationType: offer.remunerationType,
          },
        });
        if (existingOffer) {
          await tx.investmentOffer.update({
            where: { id: existingOffer.id },
            data: offer,
          });
        } else {
          await tx.investmentOffer.create({ data: offer });
        }
      }
    });
  } finally {
    try {
      await prisma.$disconnect();
    } finally {
      await pool.end();
    }
  }
}

// System curves go through the use case with the system actor, so they obey
// the domain rules and raise their events. Existing ones are left untouched.
async function seedCurves(): Promise<number> {
  const app = await NestFactory.createApplicationContext(SeedModule, {
    logger: ['error', 'warn'],
  });
  try {
    const prisma = app.get(PrismaService);
    const createCurve = app.get(CreateCurveUseCase);
    let created = 0;
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
      await prisma.$transaction((tx) =>
        TransactionContext.run(tx, async () => {
          const result = await createCurve.execute(command);
          if (result.isErr()) throw result.error;
        }),
      );
      created++;
    }
    return created;
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

  await seedOffers(connectionString);
  const created = await seedCurves();
  console.log(
    `Seeded Banco Local, ${offers.length} offers, and ${created} of ${curves.length} system curves for 2024–2028.`,
  );
}

main().catch((error: unknown) => {
  console.error('Database seed failed:', error);
  process.exitCode = 1;
});
