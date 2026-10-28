import { InvestmentPlanMember } from '@investflow/investment-simulator-domain';
import { AppError, Result } from '@investflow/shared-domain';

// The live members of an owner's plans, as the plan sees them. A deleted
// simulation has left its plans and is not read.
export abstract class InvestmentPlanMemberReader {
  // Keyed by plan id; another owner's or a deleted plan is left out.
  abstract findByPlans(
    ownerId: string,
    investmentPlanIds: readonly string[],
  ): Promise<
    Result<ReadonlyMap<string, readonly InvestmentPlanMember[]>, AppError>
  >;
}
