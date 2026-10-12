import {
  InvestmentInputs,
  Simulation,
  SimulationResult,
} from '@investflow/investment-simulator-domain';
import {
  CalendarDate,
  Money,
  Rate,
  UtcInstant,
} from '@investflow/shared-domain';
import { Prisma } from '@prisma/client';

export const simulationInclude = {
  result: { include: { balances: { orderBy: { date: 'asc' } } } },
} satisfies Prisma.SimulationInclude;

export type SimulationRecord = Prisma.SimulationGetPayload<{
  include: typeof simulationInclude;
}>;

type SimulationResultRecord = NonNullable<SimulationRecord['result']>;

export interface SimulationPersistenceData {
  readonly simulation: Prisma.SimulationUncheckedCreateInput;
  readonly result: Omit<
    Prisma.SimulationResultUncheckedCreateInput,
    'balances'
  > | null;
  readonly balances: Prisma.SimulationResultBalanceCreateManyInput[];
}

function money(value: Prisma.Decimal): Money {
  return Money.of(value.toFixed());
}

export class SimulationMapper {
  static toDomain(record: SimulationRecord): Simulation {
    return Simulation.reconstitute({
      id: record.id,
      ownerId: record.ownerId,
      offerId: record.offerId,
      investment: InvestmentInputs.create({
        principal: money(record.principal),
        investmentDate: CalendarDate.fromUtcDate(record.investmentDate).value,
        curveId: record.curveId,
      }),
      revision: record.revision,
      result: record.result
        ? SimulationMapper.resultToDomain(record.result)
        : null,
      deletedAt: record.deletedAt
        ? UtcInstant.fromDate(record.deletedAt).value
        : null,
    });
  }

  static toPersistence(simulation: Simulation): SimulationPersistenceData {
    const { investment, result } = simulation;
    return {
      simulation: {
        id: simulation.id,
        ownerId: simulation.ownerId,
        offerId: simulation.offerId,
        curveId: investment.curveId,
        principal: investment.principal.amount.toFixed(),
        investmentDate: investment.investmentDate.toUtcDate(),
        revision: simulation.revision,
        deletedAt: simulation.deletedAt?.date ?? null,
      },
      result: result
        ? SimulationMapper.resultToPersistence(simulation.id, result)
        : null,
      balances: (result?.calculation.dailyBalances ?? []).map((balance) => ({
        simulationId: simulation.id,
        date: balance.date.toUtcDate(),
        grossBalance: balance.grossBalance.amount.toFixed(),
        dailyGrossEarnings: balance.dailyGrossEarnings.amount.toFixed(),
        accumulatedGrossEarnings:
          balance.accumulatedGrossEarnings.amount.toFixed(),
      })),
    };
  }

  private static resultToDomain(
    record: SimulationResultRecord,
  ): SimulationResult {
    return SimulationResult.create({
      inputs: {
        simulationRevision: record.simulationRevision,
        offerRevision: record.offerRevision,
        curveRevision: record.curveRevision,
        methodologyVersion: record.methodologyVersion,
      },
      investmentDate: CalendarDate.fromUtcDate(record.investmentDate).value,
      maturityDate: CalendarDate.fromUtcDate(record.maturityDate).value,
      calculation: {
        methodologyVersion: record.methodologyVersion,
        maturitySummary: {
          principal: money(record.principal),
          grossBalance: money(record.grossBalance),
          grossEarnings: money(record.grossEarnings),
          netBalance: money(record.netBalance),
        },
        taxes: {
          holdingPeriodCalendarDays: record.holdingPeriodCalendarDays,
          iof: {
            base: money(record.taxableEarnings),
            rate: record.iofRate ? Rate.of(record.iofRate.toFixed()) : null,
            amount: money(record.iof),
          },
          incomeTax: {
            base: money(record.incomeTaxBase),
            rate: record.incomeTaxRate
              ? Rate.of(record.incomeTaxRate.toFixed())
              : null,
            amount: money(record.incomeTax),
          },
          total: money(record.totalTaxes),
        },
        dailyBalances: record.balances.map((balance) => ({
          date: CalendarDate.fromUtcDate(balance.date).value,
          grossBalance: money(balance.grossBalance),
          dailyGrossEarnings: money(balance.dailyGrossEarnings),
          accumulatedGrossEarnings: money(balance.accumulatedGrossEarnings),
        })),
      },
      calculatedAt: UtcInstant.fromDate(record.calculatedAt).value,
    });
  }

  private static resultToPersistence(
    simulationId: string,
    result: SimulationResult,
  ): NonNullable<SimulationPersistenceData['result']> {
    const { inputs, calculation } = result;
    const summary = calculation.maturitySummary;
    const { taxes } = calculation;
    return {
      simulationId,
      simulationRevision: inputs.simulationRevision,
      offerRevision: inputs.offerRevision,
      curveRevision: inputs.curveRevision,
      methodologyVersion: inputs.methodologyVersion,
      calculatedAt: result.calculatedAt.date,
      investmentDate: result.investmentDate.toUtcDate(),
      maturityDate: result.maturityDate.toUtcDate(),
      principal: summary.principal.amount.toFixed(),
      grossBalance: summary.grossBalance.amount.toFixed(),
      grossEarnings: summary.grossEarnings.amount.toFixed(),
      netBalance: summary.netBalance.amount.toFixed(),
      holdingPeriodCalendarDays: taxes.holdingPeriodCalendarDays,
      taxableEarnings: taxes.iof.base.amount.toFixed(),
      iofRate: taxes.iof.rate?.value.toFixed() ?? null,
      iof: taxes.iof.amount.amount.toFixed(),
      incomeTaxBase: taxes.incomeTax.base.amount.toFixed(),
      incomeTaxRate: taxes.incomeTax.rate?.value.toFixed() ?? null,
      incomeTax: taxes.incomeTax.amount.amount.toFixed(),
      totalTaxes: taxes.total.amount.toFixed(),
    };
  }
}
