import { EAppErrorCode, NotFoundError } from '@investflow/shared-domain';

export class InvestmentPlanNotFoundError extends NotFoundError {
  constructor(investmentPlanId: string) {
    super('Este plano não existe mais.', {
      code: EAppErrorCode.INVESTMENT_PLAN_NOT_FOUND,
      metadata: { investmentPlanId },
    });
  }
}
