import {
  AppErrorMetadata,
  CalendarDate,
  DomainError,
} from '@investflow/shared-domain';

export type InvestmentCalculationErrorCode =
  | 'INVESTMENT_TITLE_UNSUPPORTED'
  | 'INVESTMENT_REMUNERATION_UNSUPPORTED'
  | 'INVESTMENT_PERIOD_INVALID'
  | 'INVESTMENT_DATE_NOT_BUSINESS_DAY'
  | 'INVESTMENT_CURVE_REQUIRED'
  | 'INVESTMENT_CURVE_UNAVAILABLE'
  | 'INVESTMENT_CURVE_INCOMPATIBLE'
  | 'INVESTMENT_CURVE_COVERAGE_MISSING'
  | 'INVESTMENT_CALCULATION_FAILED';

export class InvestmentCalculationError extends DomainError {
  constructor(
    code: InvestmentCalculationErrorCode,
    reason: string,
    metadata?: AppErrorMetadata,
    cause?: unknown,
  ) {
    super(`Cannot calculate investment: ${reason}`, {
      code,
      kind:
        code === 'INVESTMENT_CALCULATION_FAILED' ? 'unexpected' : 'validation',
      metadata,
      cause,
    });
  }

  static notBusinessDay(
    field: 'investmentDate' | 'maturityDate',
    date: CalendarDate,
  ): InvestmentCalculationError {
    return new InvestmentCalculationError(
      'INVESTMENT_DATE_NOT_BUSINESS_DAY',
      'investment and maturity dates must be business days',
      { field, date: date.toIsoString() },
    );
  }

  static failed(cause: unknown): InvestmentCalculationError {
    return new InvestmentCalculationError(
      'INVESTMENT_CALCULATION_FAILED',
      'the accrual could not be calculated',
      undefined,
      cause,
    );
  }
}
