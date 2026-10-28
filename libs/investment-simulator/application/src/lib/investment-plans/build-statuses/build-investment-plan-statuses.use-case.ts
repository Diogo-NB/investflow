import { Injectable } from '@nestjs/common';
import { InvestmentPlanStatus } from '@investflow/investment-simulator-domain';
import { QueryHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { InvestmentPlanMemberReader } from '../investment-plan-member-reader.port';
import { BuildInvestmentPlanStatusesQuery } from './build-investment-plan-statuses.query';

// Keyed by plan id; another owner's or a deleted plan is left out.
@Injectable()
export class BuildInvestmentPlanStatusesUseCase
  implements
    QueryHandler<
      BuildInvestmentPlanStatusesQuery,
      ReadonlyMap<string, InvestmentPlanStatus>
    >
{
  constructor(private readonly members: InvestmentPlanMemberReader) {}

  async execute(
    query: BuildInvestmentPlanStatusesQuery,
  ): Promise<Result<ReadonlyMap<string, InvestmentPlanStatus>, AppError>> {
    const members = await this.members.findByPlans(
      query.ownerId,
      query.investmentPlanIds,
    );
    return members.map(
      (byPlan) =>
        new Map(
          [...byPlan].map(([id, planMembers]) => [
            id,
            InvestmentPlanStatus.of(planMembers),
          ]),
        ),
    );
  }
}
