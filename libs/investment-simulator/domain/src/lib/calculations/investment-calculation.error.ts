import { AppErrorMetadata, DomainError } from '@investflow/shared-domain';

export type InvestmentCalculationErrorCode =
  | 'INVESTMENT_APPLICATION_UNAVAILABLE'
  | 'INVESTMENT_OFFER_SNAPSHOT_MISMATCH'
  | 'INVESTMENT_OFFER_UNAVAILABLE'
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
}
