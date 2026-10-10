import { CalendarDate, Money, Result } from '@investflow/shared-domain';
import { CdbIncomeTaxPolicy } from './cdb-income-tax-policy.domain-service';
import { CdbIofPolicy } from './cdb-iof-policy.domain-service';
import { InvestmentCalculationError } from './investment-calculation.error';

export interface CalculateCdbTaxesInput {
  readonly grossEarnings: Money;
  readonly investmentDate: CalendarDate;
  readonly maturityDate: CalendarDate;
}

export interface CdbTaxes {
  readonly iof: Money;
  readonly incomeTax: Money;
  readonly totalTaxes: Money;
}

export class CdbTaxCalculator {
  private readonly incomeTaxPolicy = new CdbIncomeTaxPolicy();
  private readonly iofPolicy = new CdbIofPolicy();

  calculate(
    input: CalculateCdbTaxesInput,
  ): Result<CdbTaxes, InvestmentCalculationError> {
    const holdingPeriodCalendarDays = input.investmentDate.daysUntil(
      input.maturityDate,
    );
    if (holdingPeriodCalendarDays <= 0) {
      return Result.err(
        new InvestmentCalculationError(
          'INVESTMENT_PERIOD_INVALID',
          'investment date must precede maturity',
        ),
      );
    }
    return Result.fromThrowable(
      () => {
        const currency = input.grossEarnings.currency;
        const taxableEarnings = input.grossEarnings.isPositive()
          ? input.grossEarnings
          : Money.zero(currency);
        const iof = this.iofPolicy.taxOnEarnings(
          taxableEarnings,
          holdingPeriodCalendarDays,
        );
        const incomeTaxBase = taxableEarnings.subtract(iof);
        const incomeTaxRate = this.incomeTaxPolicy.rateForHoldingPeriod(
          holdingPeriodCalendarDays,
        );
        const incomeTax = incomeTaxBase.times(incomeTaxRate.value);
        return { iof, incomeTax, totalTaxes: iof.add(incomeTax) };
      },
      (cause) =>
        new InvestmentCalculationError(
          'INVESTMENT_CALCULATION_FAILED',
          'CDB taxes could not be calculated',
          undefined,
          cause,
        ),
    );
  }
}
