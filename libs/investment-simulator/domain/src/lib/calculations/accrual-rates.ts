import { Result } from '@investflow/shared-domain';
import Decimal from 'decimal.js';
import { AccrualPeriod } from './accrual-schedule';
import { InvestmentCalculationError } from './investment-calculation.error';
import { InvestmentScenario } from './investment-scenario.vo';

// A period priced as a percentage of an annual effective rate (base 252).
// A fixed rate is earned in full; an index rate in the contracted percentage.
export interface AccrualRate extends AccrualPeriod {
  readonly annualRate: Decimal;
  readonly percentage: Decimal;
}

const FULL_RATE = new Decimal(1);

export function resolveAccrualRates(
  scenario: InvestmentScenario,
  periods: readonly AccrualPeriod[],
): Result<AccrualRate[], InvestmentCalculationError> {
  const remuneration = scenario.remuneration;
  switch (remuneration.kind) {
    case 'PREFIXED':
      return Result.ok(
        periods.map((period) => ({
          ...period,
          annualRate: remuneration.annualRate.value,
          percentage: FULL_RATE,
        })),
      );
    case 'CDI_PERCENTAGE':
    case 'SELIC_PERCENTAGE':
      return scenario
        .requireIndexCurve()
        .valuesAt(periods.map((period) => period.rateReferenceDate))
        .map((values) =>
          periods.map((period, index) => ({
            ...period,
            annualRate: values[index].value,
            percentage: remuneration.percentage.value,
          })),
        )
        .mapError(
          (error) =>
            new InvestmentCalculationError(
              'INVESTMENT_CURVE_COVERAGE_MISSING',
              'the curve does not cover all accrual references',
              error.metadata,
            ),
        );
    case 'IPCA_PLUS':
      return Result.err(
        new InvestmentCalculationError(
          'INVESTMENT_REMUNERATION_UNSUPPORTED',
          'IPCA-indexed remuneration is not calculable yet',
          { remunerationKind: remuneration.kind },
        ),
      );
  }
}
