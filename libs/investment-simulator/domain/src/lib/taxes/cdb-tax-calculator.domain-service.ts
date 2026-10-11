import { Money } from '@investflow/shared-domain';
import { CdbIncomeTaxPolicy } from './cdb-income-tax-policy.domain-service';
import { CdbIofPolicy } from './cdb-iof-policy.domain-service';
import type { CdbTaxAssessment } from './cdb-tax-assessment.type';

export class CdbTaxCalculator {
  private readonly incomeTaxPolicy = new CdbIncomeTaxPolicy();
  private readonly iofPolicy = new CdbIofPolicy();

  // IOF is charged first; income tax applies to the earnings left after IOF.
  assess(
    grossEarnings: Money,
    holdingPeriodCalendarDays: number,
  ): CdbTaxAssessment {
    const iofBase = grossEarnings.isPositive()
      ? grossEarnings
      : Money.zero(grossEarnings.currency);
    const iof = this.iofPolicy.taxOnEarnings(iofBase, holdingPeriodCalendarDays);
    const incomeTaxBase = iofBase.subtract(iof);
    const incomeTaxRate = this.incomeTaxPolicy.rateForHoldingPeriod(
      holdingPeriodCalendarDays,
    );
    const incomeTax = incomeTaxBase.times(incomeTaxRate.value);
    return {
      holdingPeriodCalendarDays,
      iof: {
        base: iofBase,
        rate: this.iofPolicy.rateForHoldingPeriod(holdingPeriodCalendarDays),
        amount: iof,
      },
      incomeTax: { base: incomeTaxBase, rate: incomeTaxRate, amount: incomeTax },
      total: iof.add(incomeTax),
    };
  }
}
