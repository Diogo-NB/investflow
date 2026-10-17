import { Money, ValueObject } from '@investflow/shared-domain';
import { InvestmentTerm } from './investment-term.vo';
import { RateOfReturn } from './rate-of-return.vo';

// What the investor has at maturity on one basis, gross or net of taxes: the
// amount, what it earned (rendimento), and how good that is (rentabilidade).
// Earnings and the rate of return are derived, never stored apart.
export class MaturityOutcome extends ValueObject<MaturityOutcome> {
  readonly earnings: Money;
  readonly rateOfReturn: RateOfReturn;

  private constructor(
    readonly principal: Money,
    readonly finalBalance: Money,
    term: InvestmentTerm,
  ) {
    super();
    this.earnings = finalBalance.subtract(principal);
    this.rateOfReturn = RateOfReturn.between(principal, finalBalance, term);
  }

  static of(
    principal: Money,
    finalBalance: Money,
    term: InvestmentTerm,
  ): MaturityOutcome {
    return new MaturityOutcome(principal, finalBalance, term);
  }

  equals(other: MaturityOutcome): boolean {
    return (
      this.principal.equals(other.principal) &&
      this.finalBalance.equals(other.finalBalance) &&
      this.rateOfReturn.equals(other.rateOfReturn)
    );
  }
}
