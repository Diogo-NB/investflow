import {
  SimulationNotFoundError,
  SimulationRepository,
} from '@investflow/investment-simulator-application';
import { Simulation } from '@investflow/investment-simulator-domain';
import { Result } from '@investflow/shared-domain';
import {
  BaseRepository,
  PrismaService,
  RepositoryFindError,
  TransactionalPrismaClient,
} from '@investflow/shared-infrastructure';
import { Injectable } from '@nestjs/common';
import { SimulationMapper } from './simulation.mapper';

@Injectable()
export class PrismaSimulationRepository
  extends BaseRepository<Simulation>
  implements SimulationRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findById(
    id: string,
    ownerId: string,
  ): Promise<
    Result<Simulation, SimulationNotFoundError | RepositoryFindError>
  > {
    const simulationResult = await Result.fromPromise(
      async () => {
        const record = await this.prisma.client.simulation.findUnique({
          where: { id, ownerId, deletedAt: null },
        });
        return record ? SimulationMapper.toDomain(record) : null;
      },
      (error) => new RepositoryFindError('Simulation', id, error),
    );

    if (simulationResult.isErr()) return simulationResult;
    return simulationResult.value
      ? Result.ok(simulationResult.value)
      : Result.err(new SimulationNotFoundError(id));
  }

  protected async persistAggregate(
    simulation: Simulation,
    client: TransactionalPrismaClient,
  ): Promise<void> {
    const data = SimulationMapper.toPersistence(simulation);
    const { id, ...update } = data;

    await client.simulation.upsert({ where: { id }, create: data, update });
  }
}
