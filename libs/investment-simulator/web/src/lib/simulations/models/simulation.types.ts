import type {
  EconomicIndex,
  RemunerationKind,
  RemunerationTerms,
  TitleType,
  UnsupportedReason,
} from '../../offers/models/offer-terms';
import type {
  ContentOrigin,
  OfferSummary,
} from '../../offers/models/offer.types';

// CATALOG offers are listed in Ofertas; a SIMULATION offer holds one
// simulation's own terms.
export type OfferScope = 'CATALOG' | 'SIMULATION';

export type CalculationStatus = 'PENDING' | 'CALCULATED' | 'INVALID' | 'FAILED';

export type CalculationCauseKind =
  | 'CREATED'
  | 'SIMULATION_EDITED'
  | 'METHODOLOGY_CHANGED'
  | 'RETRY_REQUESTED'
  | 'PREMISES_CHANGED';

export interface SimulationCalculation {
  readonly status: CalculationStatus;
  readonly changedAt: string;
  // Why the calculation was last queued.
  readonly cause: {
    readonly kind: CalculationCauseKind;
  };
  // Only for INVALID: the stable error code and its details.
  readonly reason: {
    readonly code: string;
    readonly metadata: Readonly<Record<string, unknown>>;
  } | null;
}

// Terms come from the offer the simulation uses.
export interface SimulationListItem {
  readonly id: string;
  readonly offerName: string | null;
  readonly offerScope: OfferScope;
  readonly principal: string;
  readonly investmentDate: string;
  readonly maturityDate: string;
  readonly titleType: TitleType;
  readonly issuerName: string | null;
  readonly remunerationTerms: RemunerationTerms;
  // Null for fixed rates.
  readonly curve: { readonly name: string; readonly deleted: boolean } | null;
  readonly calculationStatus: CalculationStatus;
  // Calculated from the current premises with nothing queued, so the result
  // shown is final.
  readonly isSettled: boolean;
  // The last successful calculation; null until the first one.
  readonly result: {
    readonly calculatedAt: string;
    readonly netBalance: string;
    readonly netAnnualReturn: string;
  } | null;
}

export interface CurveOption {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly origin: ContentOrigin;
  readonly coverage: { readonly startDate: string; readonly endDate: string };
}

export interface RemunerationOption {
  readonly kind: RemunerationKind;
  readonly index: EconomicIndex | null;
  readonly unsupportedReason: UnsupportedReason | null;
  // Visible curves of this kind's index.
  readonly curves: readonly CurveOption[];
}

export interface OfferOption extends OfferSummary {
  readonly unsupportedReason: UnsupportedReason | null;
}

export interface IofDailyRate {
  readonly calendarDay: number;
  readonly rate: string;
}

export interface IncomeTaxBracket {
  readonly fromCalendarDays: number;
  // Null for the open last bracket.
  readonly upToCalendarDays: number | null;
  readonly rate: string;
}

export interface TaxRules {
  readonly iof: {
    readonly exemptFromCalendarDays: number;
    readonly dailyRates: readonly IofDailyRate[];
  };
  readonly incomeTax: { readonly brackets: readonly IncomeTaxBracket[] };
}

export interface TitleTypeOption {
  readonly titleType: TitleType;
  readonly incomeTaxExempt: boolean;
  readonly minimumTermMonths: number | null;
}

export interface SimulationOptions {
  readonly titleTypes: readonly TitleTypeOption[];
  readonly remunerations: readonly RemunerationOption[];
  readonly offers: readonly OfferOption[];
  readonly taxRules: TaxRules;
}

// Decimal fractions: 0.1028 is 10.28%.
export interface RateOfReturn {
  readonly forPeriod: string;
  // Over 252 business days a year.
  readonly annual: string;
  // The equivalent constant monthly rate, not any calendar month's earnings.
  readonly monthly: string;
}

// What the investor has at maturity on one basis, gross or net of taxes.
export interface MaturityOutcome {
  readonly finalBalance: string;
  readonly earnings: string;
  readonly rateOfReturn: RateOfReturn;
}

export interface Tax {
  readonly base: string;
  readonly rate: string | null;
  readonly amount: string;
  // The calculation written out by the API, shown as is.
  readonly formula: string;
}

export interface CalculationTaxes {
  // rate is null when the term is exempt from IOF.
  readonly iof: Tax;
  // rate is null when the title type is exempt from income tax.
  readonly incomeTax: Tax;
  readonly total: string;
}

export interface InvestmentTerm {
  readonly investmentDate: string;
  readonly maturityDate: string;
  // Interest and returns count business days; taxes count calendar days.
  readonly businessDays: number;
  readonly calendarDays: number;
}

export interface SimulationResult {
  readonly calculatedAt: string;
  readonly principal: string;
  // The period calculated, which later edits may have changed.
  readonly term: InvestmentTerm;
  readonly gross: MaturityOutcome;
  readonly net: MaturityOutcome;
  // Why gross and net differ.
  readonly taxes: CalculationTaxes;
}

export interface Investment {
  readonly principal: string;
  readonly investmentDate: string;
  readonly curveId: string | null;
}

export type WorkspaceOffer = Omit<OfferOption, 'unsupportedReason'> & {
  readonly deleted: boolean;
};

export type SimulationOffer = WorkspaceOffer & {
  readonly scope: OfferScope;
  readonly basedOn: WorkspaceOffer | null;
};

export interface SimulationWorkspace {
  readonly simulation: {
    readonly id: string;
    readonly revision: number;
    readonly investment: Investment;
  };
  // Also when deleted, so the screen can ask for another one. With the
  // simulation's own terms, basedOn is the offer they came from (also when
  // deleted), or null when they were typed from scratch.
  readonly offer: SimulationOffer;
  readonly curve: {
    readonly id: string;
    readonly name: string;
    readonly deleted: boolean;
    // The curve's last declared date; its last value holds after it.
    readonly lastIntervalEnd: string;
  } | null;
  readonly calculation: SimulationCalculation;
  // Calculated from the current premises with nothing queued, so the result
  // shown is final. The premises are the simulation, its offer or curve, and
  // the rules of its calculation.
  readonly isSettled: boolean;
  // From the current dates on today's UTC date, in any status; null without
  // an offer or when maturity precedes the investment date.
  readonly remainingTerm: RemainingTerm | null;
  // The last successful calculation; null until the first one.
  readonly result: SimulationResult | null;
}

// Where a simulation stands among those compared, by net annual return.
export interface ComparisonStanding {
  // Ties share a position, and the next one skips: 1, 1, 3.
  readonly position: number;
  readonly isLeader: boolean;
  // Decimal fractions: the leader's net annual return minus this one's.
  readonly netAnnualReturnGap: string;
  // The leader's net final balance minus this one's; null unless the amounts
  // are comparable.
  readonly netBalanceGap: string | null;
}

export interface ComparedSimulation extends SimulationWorkspace {
  // Ranked from the last successful result, current or not; null without one.
  readonly standing: ComparisonStanding | null;
}

export interface SimulationComparison {
  // Every simulation is settled, so the ranking is final.
  readonly isSettled: boolean;
  // Same principal, investment date, and maturity across ranked results.
  readonly areAmountsComparable: boolean;
  // In the requested order.
  readonly simulations: readonly ComparedSimulation[];
}

// NOT_STARTED counts the whole term from the investment date; MATURED has no
// term left.
export interface RemainingTerm {
  readonly phase: 'NOT_STARTED' | 'RUNNING' | 'MATURED';
  readonly calendarDays: number;
  readonly years: number;
  readonly months: number;
  readonly days: number;
}

export interface DailyBalance {
  readonly date: string;
  readonly grossBalance: string;
  readonly dailyGrossEarnings: string;
  readonly accumulatedGrossEarnings: string;
}

export interface MonthlyBalance {
  // "YYYY-MM"
  readonly month: string;
  readonly businessDays: number;
  readonly monthGrossEarnings: string;
  // As of the month's last business day.
  readonly accumulatedGrossEarnings: string;
  readonly closingGrossBalance: string;
  readonly days: readonly DailyBalance[];
}

export interface SimulationInput {
  readonly offerId: string;
  readonly investment: Investment;
}
