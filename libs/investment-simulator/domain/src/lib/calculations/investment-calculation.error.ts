import {
  AppErrorMetadata,
  CalendarDate,
  DomainError,
  EAppErrorCode,
} from '@investflow/shared-domain';

export type UnsupportedCalculationCode =
  EAppErrorCode.INVESTMENT_REMUNERATION_UNSUPPORTED;

export type InvestmentCalculationErrorCode =
  | EAppErrorCode.INVESTMENT_REMUNERATION_UNSUPPORTED
  | EAppErrorCode.INVESTMENT_PERIOD_INVALID
  | EAppErrorCode.INVESTMENT_TERM_TOO_SHORT
  | EAppErrorCode.INVESTMENT_PRINCIPAL_INVALID
  | EAppErrorCode.INVESTMENT_DATE_NOT_BUSINESS_DAY
  | EAppErrorCode.INVESTMENT_CURVE_REQUIRED
  | EAppErrorCode.INVESTMENT_CURVE_UNAVAILABLE
  | EAppErrorCode.INVESTMENT_CURVE_INCOMPATIBLE
  | EAppErrorCode.INVESTMENT_CURVE_COVERAGE_MISSING
  | EAppErrorCode.INVESTMENT_CALCULATION_FAILED;

export class InvestmentCalculationError extends DomainError {
  constructor(
    code: InvestmentCalculationErrorCode,
    reason: string,
    metadata?: AppErrorMetadata,
    cause?: unknown,
  ) {
    super(reason, {
      code,
      kind:
        code === EAppErrorCode.INVESTMENT_CALCULATION_FAILED
          ? 'unexpected'
          : 'validation',
      metadata,
      cause,
    });
  }

  static notBusinessDay(
    field: 'investmentDate' | 'maturityDate',
    date: CalendarDate,
  ): InvestmentCalculationError {
    return new InvestmentCalculationError(
      EAppErrorCode.INVESTMENT_DATE_NOT_BUSINESS_DAY,
      `${date.toPtBrString()} não é dia útil.`,
      { field, date: date.toIsoString() },
    );
  }

  static unsupported(
    code: UnsupportedCalculationCode,
    metadata: AppErrorMetadata,
  ): InvestmentCalculationError {
    return new InvestmentCalculationError(
      code,
      'O cálculo de IPCA+ ainda não está disponível.',
      metadata,
    );
  }

  static failed(cause: unknown): InvestmentCalculationError {
    return new InvestmentCalculationError(
      EAppErrorCode.INVESTMENT_CALCULATION_FAILED,
      'Não foi possível calcular o rendimento.',
      undefined,
      cause,
    );
  }
}
