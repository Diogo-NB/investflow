import { Money, Rate } from '@investflow/shared-domain';

export interface IofAssessment {
  // Gross earnings when positive, otherwise zero.
  readonly base: Money;
  // Null when the holding period is exempt from IOF.
  readonly rate: Rate | null;
  readonly amount: Money;
}

export interface IncomeTaxAssessment {
  // The IOF base left after IOF.
  readonly base: Money;
  // Null when the title type is exempt from income tax.
  readonly rate: Rate | null;
  readonly amount: Money;
}

export interface TaxAssessment {
  // Calendar days from the investment (excluded) to maturity (included).
  readonly holdingPeriodCalendarDays: number;
  readonly iof: IofAssessment;
  readonly incomeTax: IncomeTaxAssessment;
  readonly total: Money;
}
