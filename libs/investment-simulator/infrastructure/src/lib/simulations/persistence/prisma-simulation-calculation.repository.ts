import {
  SimulationCalculationNotFoundError,
  SimulationCalculationRepository,
} from '@investflow/investment-simulator-application';
import { SimulationCalculation } from '@investflow/investment-simulator-domain';
import { Result } from '@investflow/shared-domain';
import {
  BaseRepository,
  PrismaService,
  RepositoryFindError,
  TransactionalPrismaClient,
} from '@investflow/shared-infrastructure';
import { Injectable } from '@nestjs/common';
import {
  simulationCalculationInclude,
  SimulationCalculationMapper,
} from './simulation-calculation.mapper';

@Injectable()
export class PrismaSimulationCalculationRepository
  extends BaseRepository<SimulationCalculation>
  implements SimulationCalculationRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findById(
    id: string,
  ): Promise<
    Result<
      SimulationCalculation,
      SimulationCalculationNotFoundError | RepositoryFindError
    >
  > {
    const calculationResult = await Result.fromPromise(
      async () => {
        const record =
          await this.prisma.client.simulationCalculation.findUnique({
            where: { id },
            include: simulationCalculationInclude,
          });
        return record ? SimulationCalculationMapper.toDomain(record) : null;
      },
      (error) => new RepositoryFindError('SimulationCalculation', id, error),
    );

    if (calculationResult.isErr()) return calculationResult;
    return calculationResult.value
      ? Result.ok(calculationResult.value)
      : Result.err(new SimulationCalculationNotFoundError(id));
  }

  // Calculations are immutable: create only, so a second save fails loudly.
  protected async persistAggregate(
    calculation: SimulationCalculation,
    client: TransactionalPrismaClient,
  ): Promise<void> {
    await client.simulationCalculation.create({
      data: SimulationCalculationMapper.toPersistence(calculation),
    });
  }
}
