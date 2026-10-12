import {
  SimulationNotFoundError,
  SimulationRepository,
} from '@investflow/investment-simulator-application';
import {
  Simulation,
  SimulationResult,
  SimulationRevisionConflictError,
} from '@investflow/investment-simulator-domain';
import { Result } from '@investflow/shared-domain';
import {
  BaseRepository,
  PrismaService,
  RepositoryFindError,
  TransactionalPrismaClient,
} from '@investflow/shared-infrastructure';
import { Injectable } from '@nestjs/common';
import { simulationInclude, SimulationMapper } from './simulation.mapper';

interface StoredState {
  readonly revision: number;
  readonly result: SimulationResult | null;
}

@Injectable()
export class PrismaSimulationRepository
  extends BaseRepository<Simulation>
  implements SimulationRepository
{
  // What each aggregate had when it was read or last saved; a simulation
  // without it is new.
  private readonly storedStates = new WeakMap<Simulation, StoredState>();

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findById(
    id: string,
    ownerId: string,
  ): Promise<
    Result<Simulation, SimulationNotFoundError | RepositoryFindError>
  > {
    const result = await Result.fromPromise(
      async () => {
        const record = await this.prisma.client.simulation.findUnique({
          where: { id, ownerId, deletedAt: null },
          include: simulationInclude,
        });
        return record ? SimulationMapper.toDomain(record) : null;
      },
      (error) => new RepositoryFindError('Simulation', id, error),
    );
    if (result.isErr()) return result;
    if (!result.value) return Result.err(new SimulationNotFoundError(id));
    this.remember(result.value);
    return Result.ok(result.value);
  }

  // Checks the stored revision even when only the result changed, so a
  // recalculation never lands on a simulation edited elsewhere.
  protected async persistAggregate(
    simulation: Simulation,
    client: TransactionalPrismaClient,
  ): Promise<void> {
    const stored = this.storedStates.get(simulation);
    const data = SimulationMapper.toPersistence(simulation);

    if (stored === undefined) {
      await client.simulation.create({ data: data.simulation });
    } else {
      const { count } = await client.simulation.updateMany({
        where: { id: simulation.id, revision: stored.revision },
        data: data.simulation,
      });
      if (count === 0) {
        throw new SimulationRevisionConflictError(
          simulation.id,
          stored.revision,
        );
      }
    }

    if (data.result && simulation.result !== stored?.result) {
      const { simulationId, ...result } = data.result;
      await client.simulationResultBalance.deleteMany({
        where: { simulationId },
      });
      await client.simulationResult.upsert({
        where: { simulationId },
        create: data.result,
        update: result,
      });
      await client.simulationResultBalance.createMany({ data: data.balances });
    }
    this.remember(simulation);
  }

  private remember(simulation: Simulation): void {
    this.storedStates.set(simulation, {
      revision: simulation.revision,
      result: simulation.result,
    });
  }
}
