import { SimulationRun } from '@investflow/investment-simulator-domain';
import { CalendarDate, Money, UtcInstant } from '@investflow/shared-domain';
import { Prisma } from '@prisma/client';

export const simulationRunInclude = {
  balances: { orderBy: { date: 'asc' } },
} satisfies Prisma.SimulationRunInclude;

type SimulationRunRecord = Prisma.SimulationRunGetPayload<{
  include: typeof simulationRunInclude;
}>;

function money(value: Prisma.Decimal): Money {
  return Money.of(value.toFixed());
}

export class SimulationRunMapper {
  static toDomain(record: SimulationRunRecord): SimulationRun {
    const principal = money(record.principal);
    return SimulationRun.reconstitute({
      id: record.id,
      ownerId: record.ownerId,
      applicationId: record.applicationId,
      offerSnapshotId: record.offerSnapshotId,
      indexCurveId: record.indexCurveId,
      principal,
      investmentDate: CalendarDate.fromUtcDate(record.investmentDate).value,
      methodologyVersion: record.methodologyVersion,
      calculatedAt: UtcInstant.fromDate(record.calculatedAt).value,
      maturitySummary: {
        principal,
        grossBalance: money(record.grossBalance),
        grossEarnings: money(record.grossEarnings),
        iof: money(record.iof),
        incomeTax: money(record.incomeTax),
        totalTaxes: money(record.totalTaxes),
        netBalance: money(record.netBalance),
      },
      dailyBalances: record.balances.map((balance) => ({
        date: CalendarDate.fromUtcDate(balance.date).value,
        grossBalance: money(balance.grossBalance),
        dailyGrossEarnings: money(balance.dailyGrossEarnings),
        accumulatedGrossEarnings: money(balance.accumulatedGrossEarnings),
      })),
    });
  }

  static toPersistence(run: SimulationRun): Prisma.SimulationRunCreateInput {
    const summary = run.maturitySummary;
    return {
      id: run.id,
      ownerId: run.ownerId,
      application: { connect: { id: run.applicationId } },
      offerSnapshot: { connect: { id: run.offerSnapshotId } },
      ...(run.indexCurveId
        ? { indexCurve: { connect: { id: run.indexCurveId } } }
        : {}),
      principal: run.principal.amount.toFixed(),
      investmentDate: run.investmentDate.toUtcDate(),
      methodologyVersion: run.methodologyVersion,
      calculatedAt: run.calculatedAt.date,
      grossBalance: summary.grossBalance.amount.toFixed(),
      grossEarnings: summary.grossEarnings.amount.toFixed(),
      iof: summary.iof.amount.toFixed(),
      incomeTax: summary.incomeTax.amount.toFixed(),
      totalTaxes: summary.totalTaxes.amount.toFixed(),
      netBalance: summary.netBalance.amount.toFixed(),
      balances: {
        createMany: {
          data: run.dailyBalances.map((balance) => ({
            date: balance.date.toUtcDate(),
            grossBalance: balance.grossBalance.amount.toFixed(),
            dailyGrossEarnings: balance.dailyGrossEarnings.amount.toFixed(),
            accumulatedGrossEarnings:
              balance.accumulatedGrossEarnings.amount.toFixed(),
          })),
        },
      },
    };
  }
}
