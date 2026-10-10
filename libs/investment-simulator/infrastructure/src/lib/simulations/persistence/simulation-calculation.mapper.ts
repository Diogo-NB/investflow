import {
  ETitleType,
  InvestmentTerms,
  RedemptionTerms,
  RemunerationTerms,
  SimulationCalculation,
  SimulationInputs,
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
      inputs: SimulationInputs.create({
        terms: InvestmentTerms.create({
          titleType: record.titleType as ETitleType,
          issuerId: record.issuerId,
          maturityDate: CalendarDate.fromUtcDate(record.maturityDate).value,
          redemption: RedemptionTerms.create(record.redemptionType),
          remuneration: RemunerationTerms.create(
            record.remunerationType,
            Rate.of(record.rateValue.toFixed()),
          ),
        }),
        principal,
        investmentDate: CalendarDate.fromUtcDate(record.investmentDate).value,
        indexCurveId: record.indexCurveId,
      }),
      result: {
        methodologyVersion: record.methodologyVersion,
        maturitySummary: {
          principal,
          grossBalance: money(record.grossBalance),
          grossEarnings: money(record.grossEarnings),
          iof: money(record.iof),
          incomeTax: money(record.incomeTax),
          totalTaxes: money(record.totalTaxes),
          netBalance: money(record.netBalance),
        },
        taxation: {
          holdingPeriodCalendarDays: record.holdingPeriodCalendarDays,
          taxableEarnings: money(record.taxableEarnings),
          incomeTaxBase: money(record.incomeTaxBase),
          iofRate: record.iofRate ? Rate.of(record.iofRate.toFixed()) : null,
          incomeTaxRate: Rate.of(record.incomeTaxRate.toFixed()),
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
    const { inputs, result } = calculation;
    const { terms } = inputs;
    const summary = result.maturitySummary;
    const taxation = result.taxation;
    return {
      id: calculation.id,
      simulation: { connect: { id: calculation.simulationId } },
      titleType: terms.titleType,
      issuer: { connect: { id: terms.issuerId } },
      maturityDate: terms.maturityDate.toUtcDate(),
      redemptionType: terms.redemption.kind,
      remunerationType: terms.remuneration.kind,
      rateValue: terms.remuneration.contractRate.value.toFixed(),
      ...(inputs.indexCurveId
        ? { indexCurve: { connect: { id: inputs.indexCurveId } } }
        : {}),
      principal: inputs.principal.amount.toFixed(),
      investmentDate: inputs.investmentDate.toUtcDate(),
      methodologyVersion: result.methodologyVersion,
      calculatedAt: calculation.calculatedAt.date,
      grossBalance: summary.grossBalance.amount.toFixed(),
      grossEarnings: summary.grossEarnings.amount.toFixed(),
      iof: summary.iof.amount.toFixed(),
      incomeTax: summary.incomeTax.amount.toFixed(),
      totalTaxes: summary.totalTaxes.amount.toFixed(),
      netBalance: summary.netBalance.amount.toFixed(),
      holdingPeriodCalendarDays: taxation.holdingPeriodCalendarDays,
      taxableEarnings: taxation.taxableEarnings.amount.toFixed(),
      incomeTaxBase: taxation.incomeTaxBase.amount.toFixed(),
      iofRate: taxation.iofRate?.value.toFixed() ?? null,
      incomeTaxRate: taxation.incomeTaxRate.value.toFixed(),
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
