import {
  ESimulationCalculationCauseKind,
  ESimulationCalculationStatus,
  InvestmentInputs,
  InvestmentProjection,
  InvestmentTerm,
  Simulation,
  SimulationCalculation,
  SimulationResult,
} from '@investflow/investment-simulator-domain';
import {
  AppErrorMetadata,
  CalendarDate,
  EAppErrorCode,
  Money,
  Rate,
  UtcInstant,
} from '@investflow/shared-domain';
import { Prisma } from '@prisma/client';

export const simulationInclude = {
  calculation: true,
  result: { include: { balances: { orderBy: { date: 'asc' } } } },
} satisfies Prisma.SimulationInclude;

export type SimulationRecord = Prisma.SimulationGetPayload<{
  include: typeof simulationInclude;
}>;

type SimulationResultRecord = NonNullable<SimulationRecord['result']>;
type SimulationCalculationRecord = NonNullable<SimulationRecord['calculation']>;

export interface SimulationPersistenceData {
  readonly simulation: Prisma.SimulationUncheckedCreateInput;
  readonly calculation: Prisma.SimulationCalculationUncheckedCreateInput;
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
      calculation: SimulationMapper.calculationToDomain(record.calculation),
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
      calculation: SimulationMapper.calculationToPersistence(
        simulation.id,
        simulation.calculation,
      ),
      result: result
        ? SimulationMapper.resultToPersistence(simulation.id, result)
        : null,
      balances: (result?.projection.dailyBalances ?? []).map((balance) => ({
        simulationId: simulation.id,
        date: balance.date.toUtcDate(),
        grossBalance: balance.grossBalance.amount.toFixed(),
        dailyGrossEarnings: balance.dailyGrossEarnings.amount.toFixed(),
        accumulatedGrossEarnings:
          balance.accumulatedGrossEarnings.amount.toFixed(),
      })),
    };
  }

  // Every simulation is saved with its calculation row.
  private static calculationToDomain(
    record: SimulationCalculationRecord | null,
  ): SimulationCalculation {
    if (!record) throw new Error('Simulation without a calculation row');
    return SimulationCalculation.reconstitute({
      status: record.status as ESimulationCalculationStatus,
      changedAt: UtcInstant.fromDate(record.changedAt).value,
      cause: {
        kind: record.causeKind as ESimulationCalculationCauseKind,
        actorId: record.causeActorId,
      },
      inputs: {
        simulationRevision: record.simulationRevision,
        offerTermsRevision: record.offerTermsRevision,
        curveValuesRevision: record.curveValuesRevision,
      },
      reason: record.reasonCode
        ? {
            code: record.reasonCode as EAppErrorCode,
            metadata: (record.reasonMetadata ?? {}) as AppErrorMetadata,
          }
        : null,
    });
  }

  private static calculationToPersistence(
    simulationId: string,
    calculation: SimulationCalculation,
  ): SimulationPersistenceData['calculation'] {
    const { cause, inputs, reason } = calculation;
    return {
      simulationId,
      status: calculation.status,
      changedAt: calculation.changedAt.date,
      causeKind: cause.kind,
      causeActorId: cause.actorId,
      simulationRevision: inputs.simulationRevision,
      offerTermsRevision: inputs.offerTermsRevision,
      curveValuesRevision: inputs.curveValuesRevision,
      reasonCode: reason?.code ?? null,
      reasonMetadata: reason
        ? (reason.metadata as Prisma.InputJsonObject)
        : Prisma.DbNull,
    };
  }

  // The stored outcomes and rates of return are a read model; the domain
  // derives them again from the balances and taxes.
  private static resultToDomain(
    record: SimulationResultRecord,
  ): SimulationResult {
    return SimulationResult.create({
      inputs: {
        simulationRevision: record.simulationRevision,
        offerTermsRevision: record.offerTermsRevision,
        curveValuesRevision: record.curveValuesRevision,
        methodologyVersion: record.methodologyVersion,
      },
      projection: InvestmentProjection.create({
        methodologyVersion: record.methodologyVersion,
        principal: money(record.principal),
        term: InvestmentTerm.of({
          investmentDate: CalendarDate.fromUtcDate(record.investmentDate).value,
          maturityDate: CalendarDate.fromUtcDate(record.maturityDate).value,
          businessDays: record.businessDays,
        }),
        dailyBalances: record.balances.map((balance) => ({
          date: CalendarDate.fromUtcDate(balance.date).value,
          grossBalance: money(balance.grossBalance),
          dailyGrossEarnings: money(balance.dailyGrossEarnings),
          accumulatedGrossEarnings: money(balance.accumulatedGrossEarnings),
        })),
        taxes: {
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
      }),
      calculatedAt: UtcInstant.fromDate(record.calculatedAt).value,
    });
  }

  private static resultToPersistence(
    simulationId: string,
    result: SimulationResult,
  ): NonNullable<SimulationPersistenceData['result']> {
    const { inputs, projection } = result;
    const { term, taxes, gross, net } = projection;
    return {
      simulationId,
      simulationRevision: inputs.simulationRevision,
      offerTermsRevision: inputs.offerTermsRevision,
      curveValuesRevision: inputs.curveValuesRevision,
      methodologyVersion: inputs.methodologyVersion,
      calculatedAt: result.calculatedAt.date,
      investmentDate: term.investmentDate.toUtcDate(),
      maturityDate: term.maturityDate.toUtcDate(),
      businessDays: term.businessDays,
      holdingPeriodCalendarDays: term.calendarDays,
      principal: projection.principal.amount.toFixed(),
      grossBalance: gross.finalBalance.amount.toFixed(),
      grossEarnings: gross.earnings.amount.toFixed(),
      netBalance: net.finalBalance.amount.toFixed(),
      taxableEarnings: taxes.iof.base.amount.toFixed(),
      iofRate: taxes.iof.rate?.value.toFixed() ?? null,
      iof: taxes.iof.amount.amount.toFixed(),
      incomeTaxBase: taxes.incomeTax.base.amount.toFixed(),
      incomeTaxRate: taxes.incomeTax.rate?.value.toFixed() ?? null,
      incomeTax: taxes.incomeTax.amount.amount.toFixed(),
      totalTaxes: taxes.total.amount.toFixed(),
      grossPeriodReturn: gross.rateOfReturn.forPeriod.toFixed(),
      grossAnnualReturn: gross.rateOfReturn.annual.toFixed(),
      grossMonthlyReturn: gross.rateOfReturn.monthly.toFixed(),
      netPeriodReturn: net.rateOfReturn.forPeriod.toFixed(),
      netAnnualReturn: net.rateOfReturn.annual.toFixed(),
      netMonthlyReturn: net.rateOfReturn.monthly.toFixed(),
    };
  }
}
