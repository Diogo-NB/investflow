import {
  SimulationRunNotFoundError,
  SimulationRunRepository,
} from '@investflow/investment-simulator-application';
import { SimulationRun } from '@investflow/investment-simulator-domain';
import { Result } from '@investflow/shared-domain';
import {
  BaseRepository,
  PrismaService,
  RepositoryFindError,
  TransactionalPrismaClient,
} from '@investflow/shared-infrastructure';
import { Injectable } from '@nestjs/common';
import {
  simulationRunInclude,
  SimulationRunMapper,
} from './simulation-run.mapper';

@Injectable()
export class PrismaSimulationRunRepository
  extends BaseRepository<SimulationRun>
  implements SimulationRunRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findById(
    id: string,
  ): Promise<
    Result<SimulationRun, SimulationRunNotFoundError | RepositoryFindError>
  > {
    const runResult = await Result.fromPromise(
      async () => {
        const record = await this.prisma.client.simulationRun.findUnique({
          where: { id },
          include: simulationRunInclude,
        });
        return record ? SimulationRunMapper.toDomain(record) : null;
      },
      (error) => new RepositoryFindError('SimulationRun', id, error),
    );

    if (runResult.isErr()) return runResult;
    return runResult.value
      ? Result.ok(runResult.value)
      : Result.err(new SimulationRunNotFoundError(id));
  }

  // Runs are immutable: create only, so a second save fails loudly.
  protected async persistAggregate(
    run: SimulationRun,
    client: TransactionalPrismaClient,
  ): Promise<void> {
    await client.simulationRun.create({
      data: SimulationRunMapper.toPersistence(run),
    });
  }
}
