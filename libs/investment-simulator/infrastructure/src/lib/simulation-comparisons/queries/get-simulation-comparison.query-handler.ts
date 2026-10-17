import { Injectable } from '@nestjs/common';
import { SimulationNotFoundError } from '@investflow/investment-simulator-application';
import {
  ComparedSimulation,
  SimulationComparison,
} from '@investflow/investment-simulator-domain';
import { Clock, QueryHandler } from '@investflow/shared-application';
import { CalendarDate, Money, Result } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import Decimal from 'decimal.js';
import {
  SimulationWorkspaceProjection,
  SimulationWorkspaceRecord,
  simulationWorkspaceSelect,
  toSimulationWorkspace,
} from '../../simulation-workspaces/queries/simulation-workspace-projection';
import { SimulationComparisonQueryError } from './simulation-comparison-query.error';

export interface GetSimulationComparisonQuery {
  readonly ownerId: string;
  // Distinct, between the comparison's minimum and maximum.
  readonly ids: readonly string[];
}

export interface ComparisonStandingOutput {
  // Ties share a position, and the next one skips: 1, 1, 3.
  readonly position: number;
  readonly leader: boolean;
  // Decimal fractions: the leader's net annual return minus this one's.
  readonly netAnnualReturnGap: string;
  // The leader's net final balance minus this one's; null unless
  // amountsComparable.
  readonly netBalanceGap: string | null;
}

export interface ComparedSimulationOutput
  extends SimulationWorkspaceProjection {
  // Ranked by the last successful result's net annual return, current or not;
  // null without a result.
  readonly standing: ComparisonStandingOutput | null;
}

export interface GetSimulationComparisonOutput {
  // Every simulation is calculated and its result is current, so the ranking
  // is final.
  readonly settled: boolean;
  // Every ranked result has the same principal, investment date, and
  // maturity, so their amounts compare directly.
  readonly amountsComparable: boolean;
  // In the requested order.
  readonly simulations: readonly ComparedSimulationOutput[];
}

@Injectable()
export class GetSimulationComparisonQueryHandler
  implements
    QueryHandler<GetSimulationComparisonQuery, GetSimulationComparisonOutput>
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async execute({
    ownerId,
    ids,
  }: GetSimulationComparisonQuery): Promise<
    Result<
      GetSimulationComparisonOutput,
      SimulationNotFoundError | SimulationComparisonQueryError
    >
  > {
    const result = await Result.fromPromise(
      async () => {
        const records = await this.prisma.client.simulation.findMany({
          where: { id: { in: [...ids] }, ownerId, deletedAt: null },
          select: simulationWorkspaceSelect,
        });
        const byId = new Map(records.map((record) => [record.id, record]));
        const missingId = ids.find((id) => !byId.has(id));
        if (missingId) return { missingId };
        return {
          output: this.toOutput(
            ids.map((id) => byId.get(id) as SimulationWorkspaceRecord),
          ),
        };
      },
      (cause) => new SimulationComparisonQueryError(cause),
    );
    if (result.isErr()) return result;
    return result.value.output
      ? Result.ok(result.value.output)
      : Result.err(new SimulationNotFoundError(result.value.missingId));
  }

  private toOutput(
    records: readonly SimulationWorkspaceRecord[],
  ): GetSimulationComparisonOutput {
    const today = this.clock.today();
    const projections = records.map((record) =>
      toSimulationWorkspace(record, today),
    );
    const comparison = SimulationComparison.of(
      records.map((record, index) =>
        this.toComparedSimulation(record, projections[index]),
      ),
    );
    return {
      settled: comparison.settled,
      amountsComparable: comparison.amountsComparable,
      simulations: projections.map((projection) => {
        const standing = comparison.standingOf(projection.simulation.id);
        return {
          ...projection,
          standing: standing && {
            position: standing.position,
            leader: standing.leader,
            netAnnualReturnGap: standing.netAnnualReturnGap.toFixed(),
            netBalanceGap: standing.netBalanceGap?.amount.toFixed() ?? null,
          },
        };
      }),
    };
  }

  private toComparedSimulation(
    { id, result }: SimulationWorkspaceRecord,
    projection: SimulationWorkspaceProjection,
  ): ComparedSimulation {
    if (!result || !projection.result) return { id, result: null };
    return {
      id,
      result: {
        principal: Money.of(result.principal.toFixed()),
        investmentDate: CalendarDate.fromUtcDate(result.investmentDate).value,
        maturityDate: CalendarDate.fromUtcDate(result.maturityDate).value,
        netFinalBalance: Money.of(result.netBalance.toFixed()),
        netAnnualReturn: new Decimal(result.netAnnualReturn.toFixed()),
        current:
          projection.calculation.status === 'CALCULATED' &&
          !projection.result.outdated,
      },
    };
  }
}
