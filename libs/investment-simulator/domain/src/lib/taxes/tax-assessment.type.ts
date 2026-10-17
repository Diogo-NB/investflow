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

// The holding period it depends on is the term's calendar days.
export interface TaxAssessment {
  readonly iof: IofAssessment;
  readonly incomeTax: IncomeTaxAssessment;
  readonly total: Money;
}
