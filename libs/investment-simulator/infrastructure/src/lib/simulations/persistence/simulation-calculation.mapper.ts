import {
  InvestmentInputs,
  SimulationCalculation,
} from '@investflow/investment-simulator-domain';
import {
  CalendarDate,
  Money,
  Rate,
  UtcInstant,
} from '@investflow/shared-domain';
import { Prisma } from '@prisma/client';

export const simulationCalculationInclude = {
  balances: { orderBy: { date: 'asc' } },
} satisfies Prisma.SimulationCalculationInclude;

type SimulationCalculationRecord = Prisma.SimulationCalculationGetPayload<{
  include: typeof simulationCalculationInclude;
}>;

function money(value: Prisma.Decimal): Money {
  return Money.of(value.toFixed());
}

export class SimulationCalculationMapper {
  static toDomain(record: SimulationCalculationRecord): SimulationCalculation {
    const principal = money(record.principal);
    return SimulationCalculation.reconstitute({
      id: record.id,
      simulationId: record.simulationId,
      investment: InvestmentInputs.create({
        principal,
        investmentDate: CalendarDate.fromUtcDate(record.investmentDate).value,
        curveId: record.curveId,
      }),
      result: {
        methodologyVersion: record.methodologyVersion,
        maturitySummary: {
          principal,
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

  static toPersistence(
    calculation: SimulationCalculation,
  ): Prisma.SimulationCalculationCreateInput {
    const { investment, result } = calculation;
    const summary = result.maturitySummary;
    const { taxes } = result;
    return {
      id: calculation.id,
      simulation: { connect: { id: calculation.simulationId } },
      ...(investment.curveId
        ? { curve: { connect: { id: investment.curveId } } }
        : {}),
      principal: investment.principal.amount.toFixed(),
      investmentDate: investment.investmentDate.toUtcDate(),
      methodologyVersion: result.methodologyVersion,
      calculatedAt: calculation.calculatedAt.date,
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
      balances: {
        createMany: {
          data: result.dailyBalances.map((balance) => ({
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
