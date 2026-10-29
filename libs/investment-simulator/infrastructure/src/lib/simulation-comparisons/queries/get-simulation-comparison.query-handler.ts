import { Injectable } from '@nestjs/common';
import {
  BuildSimulationComparisonQuery,
  BuildSimulationComparisonUseCase,
  SimulationNotFoundError,
} from '@investflow/investment-simulator-application';
import {
  ComparedSimulation,
  SimulationComparison,
} from '@investflow/investment-simulator-domain';
import { Clock, QueryHandler } from '@investflow/shared-application';
import { AppError, CalendarDate, Result } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
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
  readonly isLeader: boolean;
  // Decimal fractions: the leader's net annual return minus this one's.
  readonly netAnnualReturnGap: string;
  // The leader's net final balance minus this one's; null unless
  // areAmountsComparable.
  readonly netBalanceGap: string | null;
}

export interface ComparedSimulationOutput
  extends SimulationWorkspaceProjection {
  // Ranked by the last successful result's net annual return, current or not;
  // null without a result.
  readonly standing: ComparisonStandingOutput | null;
}

export interface GetSimulationComparisonOutput {
  // Every simulation is settled, so the ranking is final.
  readonly isSettled: boolean;
  // Every ranked result has the same principal, investment date, and
  // maturity, so their amounts compare directly.
  readonly areAmountsComparable: boolean;
  // In the requested order.
  readonly simulations: readonly ComparedSimulationOutput[];
}

// The comparison comes from the application, which reads the simulations in
// domain terms; this handler reads what the screen shows of each and shapes
// the output.
@Injectable()
export class GetSimulationComparisonQueryHandler
  implements
    QueryHandler<GetSimulationComparisonQuery, GetSimulationComparisonOutput>
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly buildComparison: BuildSimulationComparisonUseCase,
  ) {}

  async execute({
    ownerId,
    ids,
  }: GetSimulationComparisonQuery): Promise<
    Result<GetSimulationComparisonOutput, AppError>
  > {
    const comparison = await this.buildComparison.execute(
      BuildSimulationComparisonQuery.of(ownerId, ids),
    );
    if (comparison.isErr()) return comparison;
    const records = await Result.fromPromise(
      async () => {
        const found = await this.prisma.client.simulation.findMany({
          where: { id: { in: [...ids] }, ownerId, deletedAt: null },
          select: simulationWorkspaceSelect,
        });
        return new Map(found.map((record) => [record.id, record]));
      },
      (cause) => new SimulationComparisonQueryError(cause),
    );
    if (records.isErr()) return records;
    // Deleted after the comparison was built.
    const missingId = ids.find((id) => !records.value.has(id));
    if (missingId) return Result.err(new SimulationNotFoundError(missingId));
    return Result.ok(
      this.toOutput(comparison.value, records.value, this.clock.today()),
    );
  }

  private toOutput(
    comparison: SimulationComparison,
    records: ReadonlyMap<string, SimulationWorkspaceRecord>,
    today: CalendarDate,
  ): GetSimulationComparisonOutput {
    return {
      isSettled: comparison.isSettled,
      areAmountsComparable: comparison.areAmountsComparable,
      simulations: comparison.simulations.map((simulation) =>
        this.toComparedSimulationOutput(
          comparison,
          simulation,
          records.get(simulation.id) as SimulationWorkspaceRecord,
          today,
        ),
      ),
    };
  }

  private toComparedSimulationOutput(
    comparison: SimulationComparison,
    simulation: ComparedSimulation,
    record: SimulationWorkspaceRecord,
    today: CalendarDate,
  ): ComparedSimulationOutput {
    const standing = comparison.standingOf(simulation.id);
    return {
      ...toSimulationWorkspace(record, simulation.validity, today),
      standing: standing && {
        position: standing.position,
        isLeader: standing.isLeader,
        netAnnualReturnGap: standing.netAnnualReturnGap.toFixed(),
        netBalanceGap: standing.netBalanceGap?.amount.toFixed() ?? null,
      },
    };
  }
}
