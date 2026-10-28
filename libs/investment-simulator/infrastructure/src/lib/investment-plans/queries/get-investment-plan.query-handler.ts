import { Injectable } from '@nestjs/common';
import { InvestmentPlanNotFoundError } from '@investflow/investment-simulator-application';
import { QueryHandler } from '@investflow/shared-application';
import { Result } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { Prisma } from '@prisma/client';
import { InvestmentPlanQueryError } from './investment-plan-query.error';
import {
  InvestmentPlanStatusOutput,
  liveInvestmentPlanMembers,
  toAvailableSimulationSlots,
  toInvestmentPlanStatus,
} from './investment-plan-status-projection';

export interface GetInvestmentPlanQuery {
  readonly ownerId: string;
  readonly investmentPlanId: string;
}

export interface GetInvestmentPlanOutput {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly revision: number;
  readonly simulationCount: number;
  // Zero when the plan is full.
  readonly availableSimulationSlots: number;
  readonly status: InvestmentPlanStatusOutput;
}

const investmentPlanSelect = {
  id: true,
  name: true,
  description: true,
  revision: true,
  simulations: liveInvestmentPlanMembers,
} satisfies Prisma.InvestmentPlanSelect;

type InvestmentPlanRecord = Prisma.InvestmentPlanGetPayload<{
  select: typeof investmentPlanSelect;
}>;

@Injectable()
export class GetInvestmentPlanQueryHandler
  implements QueryHandler<GetInvestmentPlanQuery, GetInvestmentPlanOutput>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: GetInvestmentPlanQuery,
  ): Promise<
    Result<
      GetInvestmentPlanOutput,
      InvestmentPlanQueryError | InvestmentPlanNotFoundError
    >
  > {
    const result = await Result.fromPromise(
      async () => {
        const record = await this.prisma.client.investmentPlan.findFirst({
          where: {
            id: query.investmentPlanId,
            ownerId: query.ownerId,
            deletedAt: null,
          },
          select: investmentPlanSelect,
        });
        return record ? this.toOutput(record) : null;
      },
      (cause) => new InvestmentPlanQueryError(cause),
    );
    if (result.isErr()) return result;
    return result.value
      ? Result.ok(result.value)
      : Result.err(new InvestmentPlanNotFoundError(query.investmentPlanId));
  }

  private toOutput({
    simulations,
    ...plan
  }: InvestmentPlanRecord): GetInvestmentPlanOutput {
    return {
      ...plan,
      simulationCount: simulations.length,
      availableSimulationSlots: toAvailableSimulationSlots(simulations),
      status: toInvestmentPlanStatus(simulations),
    };
  }
}
