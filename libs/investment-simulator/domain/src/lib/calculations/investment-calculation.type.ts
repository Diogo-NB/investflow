import { CalendarDate, Money } from '@investflow/shared-domain';
import type { CdbTaxAssessment } from '../taxes/cdb-tax-assessment.type';

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
  // The gross balance less every tax due at maturity.
  readonly netBalance: Money;
}

export interface InvestmentCalculation {
  // Identifies the calendar and formulas that produced the figures.
  readonly methodologyVersion: string;
  readonly dailyBalances: readonly DailyInvestmentBalance[];
  readonly maturitySummary: InvestmentMaturitySummary;
  readonly taxes: CdbTaxAssessment;
}
