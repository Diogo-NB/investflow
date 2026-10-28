import { Injectable } from '@nestjs/common';
import {
  BuildInvestmentPlanStatusesQuery,
  BuildInvestmentPlanStatusesUseCase,
} from '@investflow/investment-simulator-application';
import { QueryHandler } from '@investflow/shared-application';
import type { PaginatedResult } from '@investflow/shared-types';
import { AppError, Result } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { Prisma } from '@prisma/client';
import { InvestmentPlanQueryError } from './investment-plan-query.error';
import {
  InvestmentPlanStatusOutput,
  liveMemberCount,
  toAvailableSimulationSlots,
  toInvestmentPlanStatusOutput,
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
  // Zero when the plan is full.
  readonly availableSimulationSlots: number;
  readonly status: InvestmentPlanStatusOutput;
}

export type ListInvestmentPlansOutput = PaginatedResult<InvestmentPlanListItem>;

const investmentPlanSelect = {
  id: true,
  name: true,
  description: true,
  ...liveMemberCount,
} satisfies Prisma.InvestmentPlanSelect;

@Injectable()
export class ListInvestmentPlansQueryHandler
  implements QueryHandler<ListInvestmentPlansQuery, ListInvestmentPlansOutput>
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly statuses: BuildInvestmentPlanStatusesUseCase,
  ) {}

  async execute(
    query: ListInvestmentPlansQuery,
  ): Promise<Result<ListInvestmentPlansOutput, AppError>> {
    const page = await Result.fromPromise(
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
        return { records, total };
      },
      (cause) => new InvestmentPlanQueryError(cause),
    );
    if (page.isErr()) return page;
    const { records, total } = page.value;
    // One read of every member on the page, at most
    // pageSize × InvestmentPlan.SIMULATION_LIMIT rows.
    const statuses = await this.statuses.execute(
      BuildInvestmentPlanStatusesQuery.of(
        query.ownerId,
        records.map(({ id }) => id),
      ),
    );
    if (statuses.isErr()) return statuses;
    return Result.ok({
      // A plan deleted between the two reads is left out.
      items: records.flatMap(({ _count, ...plan }) => {
        const status = statuses.value.get(plan.id);
        if (!status) return [];
        return [
          {
            ...plan,
            simulationCount: _count.simulations,
            availableSimulationSlots: toAvailableSimulationSlots(
              _count.simulations,
            ),
            status: toInvestmentPlanStatusOutput(status),
          },
        ];
      }),
      total,
      page: query.page,
      pageSize: query.pageSize,
    });
  }
}
