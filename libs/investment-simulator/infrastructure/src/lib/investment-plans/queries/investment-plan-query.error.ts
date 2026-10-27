import { AppError, EAppErrorCode } from '@investflow/shared-domain';

export class InvestmentPlanQueryError extends AppError {
  constructor(cause: unknown) {
    super('Não foi possível carregar os planos.', {
      code: EAppErrorCode.INVESTMENT_PLAN_QUERY_FAILED,
      kind: 'infrastructure',
      cause,
    });
  }
}
