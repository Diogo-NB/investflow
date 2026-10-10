import { Money } from '@investflow/shared-domain';
import { CdbIncomeTaxPolicy } from './cdb-income-tax-policy.domain-service';
import { CdbIofPolicy } from './cdb-iof-policy.domain-service';
import type { TaxationBasis } from './investment-calculation.type';

export interface CdbTaxes {
  readonly iof: Money;
  readonly incomeTax: Money;
  readonly totalTaxes: Money;
  readonly basis: TaxationBasis;
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
    const incomeTaxBase = taxableEarnings.subtract(iof);
    const incomeTax = incomeTaxBase.times(incomeTaxRate.value);
    return {
      iof,
      incomeTax,
      totalTaxes: iof.add(incomeTax),
      basis: {
        holdingPeriodCalendarDays,
        taxableEarnings,
        incomeTaxBase,
        iofRate: this.iofPolicy.rateForHoldingPeriod(holdingPeriodCalendarDays),
        incomeTaxRate,
      },
    };
  }
}
