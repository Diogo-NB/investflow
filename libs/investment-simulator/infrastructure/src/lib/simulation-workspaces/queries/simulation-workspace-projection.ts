import {
  ETitleType,
  IOF_EXEMPT_FROM_CALENDAR_DAYS,
  RemainingTerm,
  SimulationResult,
  SimulationResultInputs,
} from '@investflow/investment-simulator-domain';
import { CalendarDate } from '@investflow/shared-domain';
import { Prisma } from '@prisma/client';
import {
  OfferSummary,
  offerSummarySelect,
  toOfferSummary,
} from '../../offers/queries/offer-projection';

// Shared by the workspace and the comparison, which show each simulation the
// same way.

export interface InvestmentOutput {
  readonly principal: string;
  readonly investmentDate: string;
  readonly curveId: string | null;
}

// Decimal fractions: 0.1028 is 10.28%.
export interface RateOfReturnOutput {
  readonly forPeriod: string;
  // Over 252 business days a year.
  readonly annual: string;
  // The constant monthly rate equivalent to the annual one.
  readonly monthly: string;
}

// What the investor has at maturity on one basis, gross or net of taxes.
export interface MaturityOutcomeOutput {
  readonly finalBalance: string;
  readonly earnings: string;
  readonly rateOfReturn: RateOfReturnOutput;
}

export interface TaxOutput {
  readonly base: string;
  readonly rate: string | null;
  readonly amount: string;
  // The calculation written out with its values, for display.
  readonly formula: string;
}

// An investment held to maturity, as last calculated successfully.
export interface SimulationResultOutput {
  readonly calculatedAt: string;
  readonly methodologyVersion: string;
  // True when the simulation, its offer's terms, or its curve's values changed
  // since, or the current methodology could produce different figures.
  readonly outdated: boolean;
  readonly principal: string;
  // The period calculated, which later edits may have changed. Business days
  // drive interest and returns; calendar days drive taxes.
  readonly term: {
    readonly investmentDate: string;
    readonly maturityDate: string;
    readonly businessDays: number;
    readonly calendarDays: number;
  };
  readonly gross: MaturityOutcomeOutput;
  readonly net: MaturityOutcomeOutput;
  // Why gross and net differ.
  readonly taxes: {
    // rate is null when the term is exempt from IOF.
    readonly iof: TaxOutput;
    // rate is null when the title type is exempt from income tax.
    readonly incomeTax: TaxOutput;
    readonly total: string;
  };
}

export interface SimulationCalculationOutput {
  readonly status: 'PENDING' | 'CALCULATED' | 'INVALID' | 'FAILED';
  readonly changedAt: string;
  // Why the calculation was last queued; refId is the offer or curve that
  // changed.
  readonly cause: {
    readonly kind:
      | 'CREATED'
      | 'SIMULATION_EDITED'
      | 'OFFER_CHANGED'
      | 'OFFER_DELETED'
      | 'CURVE_CHANGED'
      | 'CURVE_DELETED'
      | 'METHODOLOGY_CHANGED'
      | 'RETRY_REQUESTED';
    readonly refId: string | null;
  };
  // Only for INVALID: the stable error code and its details, such as the
  // uncovered curve ranges.
  readonly reason: {
    readonly code: string;
    readonly metadata: Record<string, unknown>;
  } | null;
}

export interface SimulationWorkspaceProjection {
  readonly simulation: {
    readonly id: string;
    readonly revision: number;
    readonly investment: InvestmentOutput;
  };
  // Also when deleted, so the screen can ask for another one.
  readonly offer: OfferSummary & { readonly deleted: boolean };
  readonly curve: {
    readonly id: string;
    readonly name: string;
    readonly deleted: boolean;
  } | null;
  readonly calculation: SimulationCalculationOutput;
  // From today's UTC date and the current investment and maturity dates, in
  // any status; null without an offer or when maturity precedes investment.
  readonly remainingTerm: {
    readonly phase: 'NOT_STARTED' | 'RUNNING' | 'MATURED';
    readonly calendarDays: number;
    readonly years: number;
    readonly months: number;
    readonly days: number;
  } | null;
  // The last successful calculation; null until the first one.
  readonly result: SimulationResultOutput | null;
}

const resultSelect = {
  simulationRevision: true,
  offerTermsRevision: true,
  curveValuesRevision: true,
  methodologyVersion: true,
  calculatedAt: true,
  investmentDate: true,
  maturityDate: true,
  principal: true,
  grossBalance: true,
  grossEarnings: true,
  iof: true,
  incomeTax: true,
  totalTaxes: true,
  netBalance: true,
  holdingPeriodCalendarDays: true,
  taxableEarnings: true,
  incomeTaxBase: true,
  iofRate: true,
  incomeTaxRate: true,
  businessDays: true,
  netAnnualReturn: true,
  netMonthlyReturn: true,
  netPeriodReturn: true,
  grossAnnualReturn: true,
  grossMonthlyReturn: true,
  grossPeriodReturn: true,
} satisfies Prisma.SimulationResultSelect;

type NumericString = `${number}`;

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const percent = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 4,
});

// Intl formats numeric strings exactly, rounding only the displayed digits.
const asNumeric = (value: Prisma.Decimal) => value.toFixed() as NumericString;

function taxFormula(
  base: Prisma.Decimal,
  rate: Prisma.Decimal,
  amount: Prisma.Decimal,
): string {
  return `${money.format(asNumeric(base))} × ${percent.format(asNumeric(rate))} = ${money.format(asNumeric(amount))}`;
}

const IOF_EXEMPT_FORMULA = `Isento: prazo de ${IOF_EXEMPT_FROM_CALENDAR_DAYS} dias ou mais`;
const INCOME_TAX_EXEMPT_FORMULA = 'Isento: LCI e LCA de pessoa física';

export const simulationWorkspaceSelect = {
  id: true,
  revision: true,
  principal: true,
  investmentDate: true,
  curveId: true,
  offer: {
    select: { ...offerSummarySelect, termsRevision: true, deletedAt: true },
  },
  curve: {
    select: { id: true, name: true, valuesRevision: true, deletedAt: true },
  },
  calculation: {
    select: {
      status: true,
      changedAt: true,
      causeKind: true,
      causeRefId: true,
      reasonCode: true,
      reasonMetadata: true,
    },
  },
  result: { select: resultSelect },
} satisfies Prisma.SimulationSelect;

export type SimulationWorkspaceRecord = Prisma.SimulationGetPayload<{
  select: typeof simulationWorkspaceSelect;
}>;

type ResultRecord = NonNullable<SimulationWorkspaceRecord['result']>;

export function toSimulationWorkspace(
  record: SimulationWorkspaceRecord,
  today: CalendarDate,
): SimulationWorkspaceProjection {
  const { offer, curve, calculation } = record;
  if (!calculation) {
    throw new Error(`Simulation ${record.id} without a calculation row`);
  }
  const investmentDate = CalendarDate.fromUtcDate(record.investmentDate).value;
  const remainingTerm = offer.deletedAt
    ? null
    : RemainingTerm.at(
        today,
        investmentDate,
        CalendarDate.fromUtcDate(offer.maturityDate).value,
      );
  return {
    simulation: {
      id: record.id,
      revision: record.revision,
      investment: {
        principal: record.principal.toFixed(),
        investmentDate: investmentDate.toIsoString(),
        curveId: record.curveId,
      },
    },
    offer: { ...toOfferSummary(offer), deleted: offer.deletedAt !== null },
    curve: curve
      ? { id: curve.id, name: curve.name, deleted: curve.deletedAt !== null }
      : null,
    calculation: {
      status: calculation.status,
      changedAt: calculation.changedAt.toISOString(),
      cause: { kind: calculation.causeKind, refId: calculation.causeRefId },
      reason: calculation.reasonCode
        ? {
            code: calculation.reasonCode,
            metadata: (calculation.reasonMetadata ?? {}) as Record<
              string,
              unknown
            >,
          }
        : null,
    },
    remainingTerm: remainingTerm && {
      phase: remainingTerm.phase,
      calendarDays: remainingTerm.calendarDays,
      years: remainingTerm.years,
      months: remainingTerm.months,
      days: remainingTerm.days,
    },
    result: record.result
      ? toResultOutput(
          record.result,
          SimulationResult.targetFor(
            record.revision,
            offer.titleType as ETitleType,
            offer.termsRevision,
            curve?.valuesRevision ?? null,
          ),
        )
      : null,
  };
}

function toResultOutput(
  record: ResultRecord,
  target: SimulationResultInputs,
): SimulationResultOutput {
  return {
    calculatedAt: record.calculatedAt.toISOString(),
    methodologyVersion: record.methodologyVersion,
    outdated: !SimulationResult.isCurrent(record, target),
    principal: record.principal.toFixed(),
    term: {
      investmentDate: CalendarDate.fromUtcDate(
        record.investmentDate,
      ).value.toIsoString(),
      maturityDate: CalendarDate.fromUtcDate(
        record.maturityDate,
      ).value.toIsoString(),
      businessDays: record.businessDays,
      calendarDays: record.holdingPeriodCalendarDays,
    },
    gross: {
      finalBalance: record.grossBalance.toFixed(),
      earnings: record.grossEarnings.toFixed(),
      rateOfReturn: {
        forPeriod: record.grossPeriodReturn.toFixed(),
        annual: record.grossAnnualReturn.toFixed(),
        monthly: record.grossMonthlyReturn.toFixed(),
      },
    },
    net: {
      finalBalance: record.netBalance.toFixed(),
      earnings: record.netBalance.minus(record.principal).toFixed(),
      rateOfReturn: {
        forPeriod: record.netPeriodReturn.toFixed(),
        annual: record.netAnnualReturn.toFixed(),
        monthly: record.netMonthlyReturn.toFixed(),
      },
    },
    taxes: {
      iof: {
        base: record.taxableEarnings.toFixed(),
        rate: record.iofRate?.toFixed() ?? null,
        amount: record.iof.toFixed(),
        formula: record.iofRate
          ? taxFormula(record.taxableEarnings, record.iofRate, record.iof)
          : IOF_EXEMPT_FORMULA,
      },
      incomeTax: {
        base: record.incomeTaxBase.toFixed(),
        rate: record.incomeTaxRate?.toFixed() ?? null,
        amount: record.incomeTax.toFixed(),
        formula: record.incomeTaxRate
          ? taxFormula(
              record.incomeTaxBase,
              record.incomeTaxRate,
              record.incomeTax,
            )
          : INCOME_TAX_EXEMPT_FORMULA,
      },
      total: record.totalTaxes.toFixed(),
    },
  };
}
