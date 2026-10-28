import { Injectable } from '@nestjs/common';
import {
  InvestmentPlanTotals,
  InvestmentPlanTotalsCalculator,
} from '@investflow/investment-simulator-domain';
import { Clock, QueryHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { InvestmentPlanMemberReader } from '../investment-plan-member-reader.port';
import { InvestmentPlanNotFoundError } from '../investment-plan-not-found.error';
import { BuildInvestmentPlanTotalsQuery } from './build-investment-plan-totals.query';

// Null when no member has a result.
@Injectable()
export class BuildInvestmentPlanTotalsUseCase
  implements
    QueryHandler<BuildInvestmentPlanTotalsQuery, InvestmentPlanTotals | null>
{
  constructor(
    private readonly members: InvestmentPlanMemberReader,
    private readonly calculator: InvestmentPlanTotalsCalculator,
    private readonly clock: Clock,
  ) {}

  async execute(
    query: BuildInvestmentPlanTotalsQuery,
  ): Promise<Result<InvestmentPlanTotals | null, AppError>> {
    const members = await this.members.findByPlans(query.ownerId, [
      query.investmentPlanId,
    ]);
    if (members.isErr()) return members;
    const planMembers = members.value.get(query.investmentPlanId);
    if (!planMembers) {
      return Result.err(
        new InvestmentPlanNotFoundError(query.investmentPlanId),
      );
    }
    return Result.ok(
      this.calculator.calculate(planMembers, this.clock.today()),
    );
  }
}
