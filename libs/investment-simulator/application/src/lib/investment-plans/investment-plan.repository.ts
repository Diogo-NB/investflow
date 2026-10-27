import { InvestmentPlan } from '@investflow/investment-simulator-domain';
import { AppError, Repository, Result } from '@investflow/shared-domain';

// A deleted plan is reported as missing.
export abstract class InvestmentPlanRepository extends Repository<InvestmentPlan> {
  // Another owner's plan is reported as missing too.
  abstract findOwned(
    id: string,
    ownerId: string,
  ): Promise<Result<InvestmentPlan, AppError>>;
}
