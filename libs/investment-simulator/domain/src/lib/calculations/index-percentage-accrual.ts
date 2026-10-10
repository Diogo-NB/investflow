import { Result } from '@investflow/shared-domain';
import Decimal from 'decimal.js';
import { EconomicIndex } from '../index-curves/economic-index.enum';
import { IndexValueConvention } from '../index-curves/index-value-convention.enum';
import { AnnualEffective252AccrualPolicy } from './annual-effective-252-accrual-policy.domain-service';
import { InvestmentCalculationError } from './investment-calculation.error';
import {
  PrepareRemunerationInput,
  PreparedDailyAccrual,
  DailyAccrual,
} from './remuneration-strategy.contract';

export function prepareIndexPercentageAccrual(
  input: PrepareRemunerationInput,
  index: EconomicIndex.CDI | EconomicIndex.SELIC,
): Result<readonly PreparedDailyAccrual[], InvestmentCalculationError> {
  const expectedKind =
    index === EconomicIndex.CDI ? 'CDI_PERCENTAGE' : 'SELIC_PERCENTAGE';
  if (input.terms.kind !== expectedKind) {
    return Result.err(
      new InvestmentCalculationError(
        'INVESTMENT_REMUNERATION_UNSUPPORTED',
        `strategy requires ${expectedKind} terms`,
      ),
    );
  }
  const curve = input.indexCurve;
  if (!curve) {
    return Result.err(
      new InvestmentCalculationError(
        'INVESTMENT_CURVE_REQUIRED',
        'an index curve is required',
        { index },
      ),
    );
  }
  if (curve.deletedAt) {
    return Result.err(
      new InvestmentCalculationError(
        'INVESTMENT_CURVE_UNAVAILABLE',
        'the curve is deleted',
        { curveId: curve.id },
      ),
    );
  }
  if (
    curve.index !== index ||
    curve.convention !== IndexValueConvention.ANNUAL_EFFECTIVE_252
  ) {
    return Result.err(
      new InvestmentCalculationError(
        'INVESTMENT_CURVE_INCOMPATIBLE',
        'curve index or convention does not match remuneration',
        { curveId: curve.id, expectedIndex: index, actualIndex: curve.index },
      ),
    );
  }

  const coveredAccruals: {
    readonly accrual: DailyAccrual;
    readonly annualRate: Decimal;
  }[] = [];
  const missingReferences: string[] = [];
  for (const accrual of input.accruals) {
    const value = curve.valueAt(accrual.rateReferenceDate);
    if (value.isErr())
      missingReferences.push(accrual.rateReferenceDate.toIsoString());
    else coveredAccruals.push({ accrual, annualRate: value.value.value });
  }
  if (missingReferences.length) {
    return Result.err(
      new InvestmentCalculationError(
        'INVESTMENT_CURVE_COVERAGE_MISSING',
        'the curve does not cover all accrual references',
        { curveId: curve.id, missingReferences },
      ),
    );
  }

  return Result.fromThrowable(
    () => {
      const factorsByRate = new Map<string, Decimal>();
      const accrualPolicy = new AnnualEffective252AccrualPolicy();
      return coveredAccruals.map(({ accrual, annualRate }) => {
        const key = annualRate.toString();
        const cached = factorsByRate.get(key);
        if (cached) return { ...accrual, factor: cached };
        const factor = accrualPolicy.percentageDailyFactor(
          annualRate,
          input.terms.rate,
        );
        factorsByRate.set(key, factor);
        return { ...accrual, factor };
      });
    },
    (cause) =>
      new InvestmentCalculationError(
        'INVESTMENT_CALCULATION_FAILED',
        'indexed factors could not be calculated',
        { curveId: curve.id },
        cause,
      ),
  );
}
