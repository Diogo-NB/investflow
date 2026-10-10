import { CalendarDate, Money, Rate } from '@investflow/shared-domain';

export interface DailyInvestmentBalance {
  readonly date: CalendarDate;
  readonly grossBalance: Money;
  readonly dailyGrossEarnings: Money;
  readonly accumulatedGrossEarnings: Money;
}

export interface InvestmentMaturitySummary {
  readonly principal: Money;
  readonly grossBalance: Money;
  readonly grossEarnings: Money;
  readonly iof: Money;
  readonly incomeTax: Money;
  readonly totalTaxes: Money;
  readonly netBalance: Money;
}

export interface TaxationBasis {
  // Calendar days from the investment (excluded) to maturity (included).
  readonly holdingPeriodCalendarDays: number;
  // Gross earnings when positive, otherwise zero; the IOF base.
  readonly taxableEarnings: Money;
  // Taxable earnings left after IOF; the income tax base.
  readonly incomeTaxBase: Money;
  // Null when the holding period is exempt from IOF.
  readonly iofRate: Rate | null;
  readonly incomeTaxRate: Rate;
}

export interface InvestmentCalculation {
  // Identifies the calendar and formulas that produced the figures.
  readonly methodologyVersion: string;
  readonly dailyBalances: readonly DailyInvestmentBalance[];
  readonly maturitySummary: InvestmentMaturitySummary;
  readonly taxation: TaxationBasis;
}
