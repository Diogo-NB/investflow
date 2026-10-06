import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { Pool } from 'pg';
import {
  curveRange,
  curves,
  issuer,
  offers,
} from './investment-simulator/fixtures';

async function main(): Promise<void> {
  config();
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString?.trim()) {
    throw new Error('DATABASE_URL is required to seed the local database');
  }

  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    await prisma.$transaction(async (tx) => {
      const existingIssuer = await tx.investmentIssuer.findFirst({
        where: { name: issuer.name },
      });
      const seededIssuer =
        existingIssuer ?? (await tx.investmentIssuer.create({ data: issuer }));

      for (const offer of offers) {
        const existingOffer = await tx.investmentOffer.findFirst({
          where: {
            issuerId: seededIssuer.id,
            titleType: offer.titleType,
            redemptionType: offer.redemptionType,
            remunerationType: offer.remunerationType,
          },
        });
        const data = { ...offer, issuerId: seededIssuer.id };
        if (existingOffer) {
          await tx.investmentOffer.update({
            where: { id: existingOffer.id },
            data,
          });
        } else {
          await tx.investmentOffer.create({ data });
        }
      }

      for (const { value, ...curve } of curves) {
        const existingCurve = await tx.indexCurve.findFirst({
          where: { name: curve.name, index: curve.index },
        });
        const seededCurve = existingCurve
          ? await tx.indexCurve.update({
              where: { id: existingCurve.id },
              data: curve,
            })
          : await tx.indexCurve.create({ data: curve });
        await tx.indexCurveInterval.deleteMany({
          where: { curveId: seededCurve.id },
        });
        await tx.indexCurveInterval.create({
          data: { curveId: seededCurve.id, ...curveRange, value },
        });
      }
    });

    console.log(
      `Seeded Banco Local, ${offers.length} offers, and ${curves.length} index curves for 2026–2028.`,
    );
  } finally {
    try {
      await prisma.$disconnect();
    } finally {
      await pool.end();
    }
  }
}

main().catch((error: unknown) => {
  console.error('Database seed failed:', error);
  process.exitCode = 1;
});
