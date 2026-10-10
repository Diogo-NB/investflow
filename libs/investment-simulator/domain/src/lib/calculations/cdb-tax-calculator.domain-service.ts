import { Money } from '@investflow/shared-domain';
import { CdbIncomeTaxPolicy } from './cdb-income-tax-policy.domain-service';
import { CdbIofPolicy } from './cdb-iof-policy.domain-service';

export interface CdbTaxes {
  readonly iof: Money;
  readonly incomeTax: Money;
  readonly totalTaxes: Money;
}

export class CdbTaxCalculator {
  private readonly incomeTaxPolicy = new CdbIncomeTaxPolicy();
  private readonly iofPolicy = new CdbIofPolicy();

  // IOF is charged first; income tax applies to the earnings left after IOF.
  calculate(grossEarnings: Money, holdingPeriodCalendarDays: number): CdbTaxes {
    const taxableEarnings = grossEarnings.isPositive()
      ? grossEarnings
      : Money.zero(grossEarnings.currency);
    const iof = this.iofPolicy.taxOnEarnings(
      taxableEarnings,
      holdingPeriodCalendarDays,
    );
    const incomeTaxRate = this.incomeTaxPolicy.rateForHoldingPeriod(
      holdingPeriodCalendarDays,
    );
    const incomeTax = taxableEarnings.subtract(iof).times(incomeTaxRate.value);
    return { iof, incomeTax, totalTaxes: iof.add(incomeTax) };
  }
}
