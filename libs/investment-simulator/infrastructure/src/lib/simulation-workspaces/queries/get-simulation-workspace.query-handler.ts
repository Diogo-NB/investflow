import { Injectable } from '@nestjs/common';
import {
  SimulationNotFoundError,
  SimulationResultValidityReader,
} from '@investflow/investment-simulator-application';
import { Clock, QueryHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
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

// Whether the result holds comes from a read port in domain terms; this
// handler reads what the screen shows and shapes the output.
@Injectable()
export class GetSimulationWorkspaceQueryHandler
  implements
    QueryHandler<GetSimulationWorkspaceQuery, GetSimulationWorkspaceOutput>
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly validities: SimulationResultValidityReader,
  ) {}

  async execute({
    ownerId,
    simulationId,
  }: GetSimulationWorkspaceQuery): Promise<
    Result<GetSimulationWorkspaceOutput, AppError>
  > {
    const validities = await this.validities.findOwned(ownerId, [simulationId]);
    if (validities.isErr()) return validities;
    const validity = validities.value.get(simulationId);
    if (!validity) return Result.err(new SimulationNotFoundError(simulationId));
    const result = await Result.fromPromise(
      async () => {
        const record = await this.prisma.client.simulation.findFirst({
          where: { id: simulationId, ownerId, deletedAt: null },
          select: simulationWorkspaceSelect,
        });
        return record
          ? toSimulationWorkspace(record, validity, this.clock.today())
          : null;
      },
      (cause) => new SimulationWorkspaceQueryError(cause),
    );
    if (result.isErr()) return result;
    // Null when deleted after its validity was read.
    return result.value
      ? Result.ok(result.value)
      : Result.err(new SimulationNotFoundError(simulationId));
  }
}
