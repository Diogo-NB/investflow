import { Money, ValueObject } from '@investflow/shared-domain';
import Decimal from 'decimal.js';
import { BUSINESS_DAYS_PER_YEAR, InvestmentTerm } from './investment-term.vo';

// What an amount earned relative to the principal (rentabilidade), as decimal
// fractions: 0.1028 is 10.28%. Not to be confused with Rate, which holds
// contracted and tax rates.
export class RateOfReturn extends ValueObject<RateOfReturn> {
  private constructor(
    readonly forPeriod: Decimal,
    // Spread over 252 business days a year, the capitalization convention, so
    // a prefixed offer's gross annual return equals its rate.
    readonly annual: Decimal,
    // The constant monthly rate equivalent to the annual one, not what any
    // calendar month earned.
    readonly monthly: Decimal,
  ) {
    super();
  }

  static between(
    principal: Money,
    finalBalance: Money,
    term: InvestmentTerm,
  ): RateOfReturn {
    const forPeriod = finalBalance.amount.div(principal.amount).minus(1);
    const annual = forPeriod
      .plus(1)
      .pow(new Decimal(BUSINESS_DAYS_PER_YEAR).div(term.businessDays))
      .minus(1);
    const monthly = annual
      .plus(1)
      .pow(new Decimal(1).div(12))
      .minus(1);
    return new RateOfReturn(forPeriod, annual, monthly);
  }

  equals(other: RateOfReturn): boolean {
    return (
      this.forPeriod.equals(other.forPeriod) &&
      this.annual.equals(other.annual) &&
      this.monthly.equals(other.monthly)
    );
  }
}
