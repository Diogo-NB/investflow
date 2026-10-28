import { Injectable } from '@nestjs/common';
import {
  BuildInvestmentPlanStatusesQuery,
  BuildInvestmentPlanStatusesUseCase,
  BuildInvestmentPlanTotalsQuery,
  BuildInvestmentPlanTotalsUseCase,
  InvestmentPlanNotFoundError,
} from '@investflow/investment-simulator-application';
import { InvestmentPlanTotals } from '@investflow/investment-simulator-domain';
import { QueryHandler } from '@investflow/shared-application';
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

export interface GetInvestmentPlanQuery {
  readonly ownerId: string;
  readonly investmentPlanId: string;
}

export interface InvestmentPlanMaturityMonthOutput {
  // YYYY-MM.
  readonly month: string;
  readonly simulationCount: number;
  // Those whose maturity date is on or before today.
  readonly maturedSimulationCount: number;
  readonly netFinalBalance: string;
  // This month's net amount plus every earlier month's.
  readonly accumulatedNetFinalBalance: string;
}

// Splits the principal included in the totals; the shares are decimal
// fractions that add up to 1.
export interface InvestmentPlanLiquidityOutput {
  readonly dailyPrincipal: string;
  readonly atMaturityPrincipal: string;
  readonly dailyShare: string;
  readonly atMaturityShare: string;
}

// From each member's last successful result, current or not, at its own
// maturity.
export interface InvestmentPlanTotalsOutput {
  // Members without a result, left out of every amount.
  readonly excludedSimulationCount: number;
  // Some member is calculating, has a pending issue, or a stale result.
  readonly isProvisional: boolean;
  readonly principal: string;
  readonly iof: string;
  readonly incomeTax: string;
  readonly netFinalBalance: string;
  readonly netEarnings: string;
  // From the first investment date to the last maturity.
  readonly period: { readonly start: string; readonly end: string };
  // Ascending, only the months with a maturity.
  readonly maturityMonths: readonly InvestmentPlanMaturityMonthOutput[];
  readonly liquidity: InvestmentPlanLiquidityOutput;
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
  // Null when no member has a result.
  readonly totals: InvestmentPlanTotalsOutput | null;
}

const investmentPlanSelect = {
  id: true,
  name: true,
  description: true,
  revision: true,
  ...liveMemberCount,
} satisfies Prisma.InvestmentPlanSelect;

// The status and totals come from the application, which reads the members
// in domain terms; this handler reads the plan itself and shapes the output.
@Injectable()
export class GetInvestmentPlanQueryHandler
  implements QueryHandler<GetInvestmentPlanQuery, GetInvestmentPlanOutput>
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly statuses: BuildInvestmentPlanStatusesUseCase,
    private readonly totals: BuildInvestmentPlanTotalsUseCase,
  ) {}

  async execute({
    ownerId,
    investmentPlanId,
  }: GetInvestmentPlanQuery): Promise<
    Result<GetInvestmentPlanOutput, AppError>
  > {
    const plan = await Result.fromPromise(
      () =>
        this.prisma.client.investmentPlan.findFirst({
          where: { id: investmentPlanId, ownerId, deletedAt: null },
          select: investmentPlanSelect,
        }),
      (cause) => new InvestmentPlanQueryError(cause),
    );
    if (plan.isErr()) return plan;
    if (!plan.value) {
      return Result.err(new InvestmentPlanNotFoundError(investmentPlanId));
    }
    const statuses = await this.statuses.execute(
      BuildInvestmentPlanStatusesQuery.of(ownerId, [investmentPlanId]),
    );
    if (statuses.isErr()) return statuses;
    const status = statuses.value.get(investmentPlanId);
    if (!status) {
      return Result.err(new InvestmentPlanNotFoundError(investmentPlanId));
    }
    const totals = await this.totals.execute(
      BuildInvestmentPlanTotalsQuery.of(ownerId, investmentPlanId),
    );
    if (totals.isErr()) return totals;

    const { _count, ...header } = plan.value;
    return Result.ok({
      ...header,
      simulationCount: _count.simulations,
      availableSimulationSlots: toAvailableSimulationSlots(_count.simulations),
      status: toInvestmentPlanStatusOutput(status),
      totals: totals.value && this.toTotalsOutput(totals.value),
    });
  }

  private toTotalsOutput(
    totals: InvestmentPlanTotals,
  ): InvestmentPlanTotalsOutput {
    const { liquidity } = totals;
    return {
      excludedSimulationCount: totals.excludedSimulationCount,
      isProvisional: totals.isProvisional,
      principal: totals.principal.amount.toFixed(),
      iof: totals.iof.amount.toFixed(),
      incomeTax: totals.incomeTax.amount.toFixed(),
      netFinalBalance: totals.netFinalBalance.amount.toFixed(),
      netEarnings: totals.netEarnings.amount.toFixed(),
      period: {
        start: totals.period.start.toIsoString(),
        end: totals.period.end.toIsoString(),
      },
      maturityMonths: totals.maturityMonths.map((month) => ({
        month: `${String(month.year).padStart(4, '0')}-${String(month.month).padStart(2, '0')}`,
        simulationCount: month.simulationCount,
        maturedSimulationCount: month.maturedSimulationCount,
        netFinalBalance: month.netFinalBalance.amount.toFixed(),
        accumulatedNetFinalBalance:
          month.accumulatedNetFinalBalance.amount.toFixed(),
      })),
      liquidity: {
        dailyPrincipal: liquidity.dailyPrincipal.amount.toFixed(),
        atMaturityPrincipal: liquidity.atMaturityPrincipal.amount.toFixed(),
        dailyShare: liquidity.dailyShare.toFixed(),
        atMaturityShare: liquidity.atMaturityShare.toFixed(),
      },
    };
  }
}
