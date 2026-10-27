import { Injectable } from '@nestjs/common';
import { QueryHandler } from '@investflow/shared-application';
import type { PaginatedResult } from '@investflow/shared-types';
import { Result } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { Prisma } from '@prisma/client';
import { InvestmentPlanQueryError } from './investment-plan-query.error';
import {
  InvestmentPlanStatusOutput,
  liveInvestmentPlanMembers,
  toInvestmentPlanStatus,
} from './investment-plan-status-projection';

export interface ListInvestmentPlansQuery {
  readonly ownerId: string;
  readonly page: number;
  readonly pageSize: number;
  // Only the plans this simulation belongs to.
  readonly simulationId?: string;
}

export interface InvestmentPlanListItem {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly simulationCount: number;
  readonly status: InvestmentPlanStatusOutput;
}

export type ListInvestmentPlansOutput = PaginatedResult<InvestmentPlanListItem>;

// A page reads at most pageSize × InvestmentPlan.SIMULATION_LIMIT members.
const investmentPlanSelect = {
  id: true,
  name: true,
  description: true,
  simulations: liveInvestmentPlanMembers,
} satisfies Prisma.InvestmentPlanSelect;

@Injectable()
export class ListInvestmentPlansQueryHandler
  implements QueryHandler<ListInvestmentPlansQuery, ListInvestmentPlansOutput>
{
  constructor(private readonly prisma: PrismaService) {}

  execute(
    query: ListInvestmentPlansQuery,
  ): Promise<Result<ListInvestmentPlansOutput, InvestmentPlanQueryError>> {
    return Result.fromPromise(
      async () => {
        const where: Prisma.InvestmentPlanWhereInput = {
          ownerId: query.ownerId,
          deletedAt: null,
          ...(query.simulationId && {
            simulations: {
              some: {
                simulationId: query.simulationId,
                simulation: { deletedAt: null },
              },
            },
          }),
        };
        const [records, total] = await Promise.all([
          this.prisma.client.investmentPlan.findMany({
            where,
            select: investmentPlanSelect,
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
          }),
          this.prisma.client.investmentPlan.count({ where }),
        ]);
        return {
          items: records.map(({ simulations, ...plan }) => ({
            ...plan,
            simulationCount: simulations.length,
            status: toInvestmentPlanStatus(simulations),
          })),
          total,
          page: query.page,
          pageSize: query.pageSize,
        };
      },
      (cause) => new InvestmentPlanQueryError(cause),
    );
  }
}
