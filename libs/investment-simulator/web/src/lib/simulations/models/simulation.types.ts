import type {
  EconomicIndex,
  RedemptionKind,
  RemunerationKind,
  RemunerationTerms,
  TitleType,
  UnsupportedReason,
} from '../../offers/models/offer-terms';

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
  // Null until the first successful calculation.
  readonly result: {
    readonly calculatedAt: string;
    readonly outdated: boolean;
    readonly netBalance: string;
  } | null;
}

export type ContentOrigin = 'SYSTEM' | 'OWN';

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

export interface OfferOption {
  readonly id: string;
  readonly titleType: TitleType;
  readonly name: string;
  readonly origin: ContentOrigin;
  readonly revision: number;
  readonly issuerName: string | null;
  readonly maturityDate: string;
  readonly redemptionTerms: { readonly kind: RedemptionKind };
  readonly remunerationTerms: RemunerationTerms;
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

export interface MaturitySummary {
  readonly principal: string;
  readonly grossBalance: string;
  readonly grossEarnings: string;
  readonly iof: string;
  readonly incomeTax: string;
  readonly totalTaxes: string;
  readonly netBalance: string;
}

export interface SimulationResult {
  readonly calculatedAt: string;
  // The period calculated, which later edits may have changed.
  readonly investmentDate: string;
  readonly maturityDate: string;
  readonly methodologyVersion: string;
  // The simulation, its offer or curve changed since, or the current
  // methodology could produce different figures.
  readonly outdated: boolean;
  readonly businessDays: number;
  readonly maturitySummary: MaturitySummary;
  readonly taxes: CalculationTaxes;
}

export interface CalculationTaxes {
  readonly holdingPeriodCalendarDays: number;
  // rate is null when the holding period is exempt from IOF. formula is the
  // calculation written out by the API, shown as is.
  readonly iof: {
    readonly base: string;
    readonly rate: string | null;
    readonly amount: string;
    readonly formula: string;
  };
  // rate is null when the title type is exempt from income tax.
  readonly incomeTax: {
    readonly base: string;
    readonly rate: string | null;
    readonly amount: string;
    readonly formula: string;
  };
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
  // Null until the first successful calculation.
  readonly result: SimulationResult | null;
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

export interface OfferTermsInput {
  readonly titleType: TitleType;
  readonly name: string;
  readonly issuerName: string | null;
  readonly maturityDate: string;
  readonly redemptionTerms: { readonly kind: RedemptionKind };
  readonly remunerationTerms: RemunerationTerms;
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
