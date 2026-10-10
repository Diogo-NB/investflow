import { CalendarDate, Money } from '@investflow/shared-domain';

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

export interface InvestmentCalculation {
  readonly dailyBalances: readonly DailyInvestmentBalance[];
  readonly maturitySummary: InvestmentMaturitySummary;
}
