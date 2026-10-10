import { Result } from '@investflow/shared-domain';
import { AnnualEffective252AccrualPolicy } from './annual-effective-252-accrual-policy.domain-service';
import { InvestmentCalculationError } from './investment-calculation.error';
import {
  PrepareRemunerationInput,
  PreparedDailyAccrual,
  RemunerationStrategy,
} from './remuneration-strategy.contract';

export class PrefixedRemunerationStrategy implements RemunerationStrategy {
  readonly kind = 'PREFIXED';
  private readonly accrualPolicy = new AnnualEffective252AccrualPolicy();

  prepare(
    input: PrepareRemunerationInput,
  ): Result<readonly PreparedDailyAccrual[], InvestmentCalculationError> {
    if (input.terms.kind !== this.kind) {
      return Result.err(
        new InvestmentCalculationError(
          'INVESTMENT_REMUNERATION_UNSUPPORTED',
          'fixed-rate strategy requires PREFIXED terms',
        ),
      );
    }
    return Result.fromThrowable(
      () => {
        const factor = this.accrualPolicy.dailyFactor(input.terms.rate.value);
        return input.accruals.map((accrual) => ({ ...accrual, factor }));
      },
      (cause) =>
        new InvestmentCalculationError(
          'INVESTMENT_CALCULATION_FAILED',
          'fixed-rate factors could not be calculated',
          undefined,
          cause,
        ),
    );
  }
}
