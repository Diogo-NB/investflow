import { Money } from '@investflow/shared-domain';
import { TITLE_TYPE_RULES } from '../offers/title-type-rules';
import { ETitleType } from '../offers/title-type.enum';
import { IofPolicy } from './iof-policy.domain-service';
import type { TaxAssessment } from './tax-assessment.type';

export class TaxCalculator {
  private readonly iofPolicy = new IofPolicy();

  // IOF is charged first; income tax applies to the earnings left after IOF.
  assess(
    titleType: ETitleType,
    grossEarnings: Money,
    holdingPeriodCalendarDays: number,
  ): TaxAssessment {
    const iofBase = grossEarnings.isPositive
      ? grossEarnings
      : Money.zero(grossEarnings.currency);
    const iof = this.iofPolicy.taxOnEarnings(
      iofBase,
      holdingPeriodCalendarDays,
    );
    const incomeTaxBase = iofBase.subtract(iof);
    const incomeTaxRate =
      TITLE_TYPE_RULES[titleType].incomeTax?.rateForHoldingPeriod(
        holdingPeriodCalendarDays,
      ) ?? null;
    const incomeTax = incomeTaxRate
      ? incomeTaxBase.times(incomeTaxRate.value)
      : Money.zero(incomeTaxBase.currency);
    return {
      iof: {
        base: iofBase,
        rate: this.iofPolicy.rateForHoldingPeriod(holdingPeriodCalendarDays),
        amount: iof,
      },
      incomeTax: {
        base: incomeTaxBase,
        rate: incomeTaxRate,
        amount: incomeTax,
      },
      total: iof.add(incomeTax),
    };
  }
}
