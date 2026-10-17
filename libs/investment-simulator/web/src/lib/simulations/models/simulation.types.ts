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
  OfferTermsInput,
} from '../../offers/models/offer.types';

export type CalculationStatus = 'PENDING' | 'CALCULATED' | 'INVALID' | 'FAILED';

export type CalculationCauseKind =
  | 'CREATED'
  | 'SIMULATION_EDITED'
  | 'OFFER_CHANGED'
  | 'OFFER_DELETED'
  | 'CURVE_CHANGED'
  | 'CURVE_DELETED'
  | 'METHODOLOGY_CHANGED'
  | 'RETRY_REQUESTED';

export interface SimulationCalculation {
  readonly status: CalculationStatus;
  readonly changedAt: string;
  // Why the calculation was last queued; refId is the offer or curve that
  // changed.
  readonly cause: {
    readonly kind: CalculationCauseKind;
    readonly refId: string | null;
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
  readonly offerName: string;
  readonly principal: string;
  readonly investmentDate: string;
  readonly maturityDate: string;
  readonly titleType: TitleType;
  readonly issuerName: string | null;
  readonly remunerationTerms: RemunerationTerms;
  readonly calculationStatus: CalculationStatus;
  // The last successful calculation; null until the first one.
  readonly result: {
    readonly calculatedAt: string;
    readonly outdated: boolean;
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
  readonly methodologyVersion: string;
  // The simulation, its offer or curve changed since, or the current
  // methodology could produce different figures.
  readonly outdated: boolean;
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

export interface SimulationWorkspace {
  readonly simulation: {
    readonly id: string;
    readonly revision: number;
    readonly investment: Investment;
  };
  // Also when deleted, so the screen can ask for another one.
  readonly offer: Omit<OfferOption, 'unsupportedReason'> & {
    readonly deleted: boolean;
  };
  readonly curve: {
    readonly id: string;
    readonly name: string;
    readonly deleted: boolean;
  } | null;
  readonly calculation: SimulationCalculation;
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
  readonly leader: boolean;
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
  // Every simulation is calculated and current, so the ranking is final.
  readonly settled: boolean;
  // Same principal, investment date, and maturity across ranked results.
  readonly amountsComparable: boolean;
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

// A visible offer, or the terms of a new private offer saved with the
// simulation.
export type SimulationOfferInput =
  | { readonly id: string }
  | { readonly new: OfferTermsInput };

export interface SimulationInput {
  readonly offer: SimulationOfferInput;
  readonly investment: Investment;
}
