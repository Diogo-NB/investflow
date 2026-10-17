import { Injectable } from '@nestjs/common';
import { SimulationNotFoundError } from '@investflow/investment-simulator-application';
import { Clock, QueryHandler } from '@investflow/shared-application';
import { Result } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import {
  SimulationWorkspaceProjection,
  simulationWorkspaceSelect,
  toSimulationWorkspace,
} from './simulation-workspace-projection';
import { SimulationWorkspaceQueryError } from './simulation-workspace-query.error';

export interface GetSimulationWorkspaceQuery {
  readonly ownerId: string;
  readonly simulationId: string;
}

export type GetSimulationWorkspaceOutput = SimulationWorkspaceProjection;

@Injectable()
export class GetSimulationWorkspaceQueryHandler
  implements
    QueryHandler<GetSimulationWorkspaceQuery, GetSimulationWorkspaceOutput>
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async execute({
    ownerId,
    simulationId,
  }: GetSimulationWorkspaceQuery): Promise<
    Result<
      GetSimulationWorkspaceOutput,
      SimulationNotFoundError | SimulationWorkspaceQueryError
    >
  > {
    const result = await Result.fromPromise(
      async () => {
        const record = await this.prisma.client.simulation.findFirst({
          where: { id: simulationId, ownerId, deletedAt: null },
          select: simulationWorkspaceSelect,
        });
        return record
          ? toSimulationWorkspace(record, this.clock.today())
          : null;
      },
      (cause) => new SimulationWorkspaceQueryError(cause),
    );
    if (result.isErr()) return result;
    return result.value
      ? Result.ok(result.value)
      : Result.err(new SimulationNotFoundError(simulationId));
  }
}
