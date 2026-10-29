import {
  SimulationNotFoundError,
  SimulationRepository,
} from '@investflow/investment-simulator-application';
import {
  ESimulationCalculationStatus,
  Simulation,
  SimulationCalculation,
  SimulationCalculationStaleError,
  SimulationResult,
  SimulationRevisionConflictError,
} from '@investflow/investment-simulator-domain';
import { DomainEventRecorder, Result } from '@investflow/shared-domain';
import {
  BaseRepository,
  PrismaService,
  RepositoryFindError,
  TransactionalPrismaClient,
} from '@investflow/shared-infrastructure';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  simulationInclude,
  SimulationMapper,
  SimulationPersistenceData,
} from './simulation.mapper';

interface StoredState {
  readonly revision: number;
  readonly calculation: SimulationCalculation;
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

  constructor(prisma: PrismaService, events: DomainEventRecorder) {
    super(prisma, events);
  }

  findById(
    id: string,
  ): Promise<
    Result<Simulation, SimulationNotFoundError | RepositoryFindError>
  > {
    return this.find(id, {});
  }

  findOwned(
    id: string,
    ownerId: string,
  ): Promise<
    Result<Simulation, SimulationNotFoundError | RepositoryFindError>
  > {
    return this.find(id, { ownerId });
  }

  findIdsByOffer(
    offerId: string,
  ): Promise<Result<string[], RepositoryFindError>> {
    return this.findIdsWhere({ offerId }, offerId);
  }

  findIdsByCurve(
    curveId: string,
  ): Promise<Result<string[], RepositoryFindError>> {
    return this.findIdsWhere({ curveId }, curveId);
  }

  findIdsOwnedBy(
    ownerId: string,
    ids: readonly string[],
  ): Promise<Result<string[], RepositoryFindError>> {
    return Result.fromPromise(
      async () => {
        const records = await this.prisma.client.simulation.findMany({
          where: { id: { in: [...ids] }, ownerId, deletedAt: null },
          select: { id: true },
        });
        return records.map((record) => record.id);
      },
      (error) => new RepositoryFindError('Simulation', ownerId, error),
    );
  }

  // A request (PENDING) always replaces the calculation row, after the usual
  // revision check on the simulation. An outcome is written only while the
  // row still applies to the simulation revision it was calculated for, and
  // never touches the simulation row.
  protected async persistAggregate(
    simulation: Simulation,
    client: TransactionalPrismaClient,
  ): Promise<void> {
    const stored = this.storedStates.get(simulation);
    const data = SimulationMapper.toPersistence(simulation);

    if (stored === undefined) {
      await client.simulation.create({ data: data.simulation });
      await client.simulationCalculation.create({ data: data.calculation });
    } else if (
      simulation.calculation !== stored.calculation &&
      !simulation.calculation.isPending
    ) {
      await this.recordOutcome(client, data, stored);
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
      if (simulation.calculation !== stored.calculation) {
        const { simulationId, ...calculation } = data.calculation;
        await client.simulationCalculation.upsert({
          where: { simulationId },
          create: data.calculation,
          update: calculation,
        });
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

  // A failure is recorded only over the calculation the use case read: the
  // dead-letter consumer and the worker read different queues, so an outcome
  // can land in between. Every transition sets changedAt.
  private async recordOutcome(
    client: TransactionalPrismaClient,
    data: SimulationPersistenceData,
    stored: StoredState,
  ): Promise<void> {
    const { simulationId, ...calculation } = data.calculation;
    const { simulationRevision } = stored.calculation;
    const { count } = await client.simulationCalculation.updateMany({
      where: {
        simulationId,
        simulationRevision,
        ...(calculation.status === ESimulationCalculationStatus.FAILED && {
          status: stored.calculation.status,
          changedAt: stored.calculation.changedAt.date,
        }),
      },
      data: calculation,
    });
    if (count === 0) {
      throw new SimulationCalculationStaleError(
        simulationId,
        simulationRevision,
      );
    }
  }

  private findIdsWhere(
    premise: Prisma.SimulationWhereInput,
    premiseId: string,
  ): Promise<Result<string[], RepositoryFindError>> {
    return Result.fromPromise(
      async () => {
        const records = await this.prisma.client.simulation.findMany({
          where: { ...premise, deletedAt: null },
          select: { id: true },
        });
        return records.map((record) => record.id);
      },
      (error) => new RepositoryFindError('Simulation', premiseId, error),
    );
  }

  private async find(
    id: string,
    scope: Prisma.SimulationWhereInput,
  ): Promise<
    Result<Simulation, SimulationNotFoundError | RepositoryFindError>
  > {
    const result = await Result.fromPromise(
      async () => {
        const record = await this.prisma.client.simulation.findFirst({
          where: { ...scope, id, deletedAt: null },
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

  private remember(simulation: Simulation): void {
    this.storedStates.set(simulation, {
      revision: simulation.revision,
      calculation: simulation.calculation,
      result: simulation.result,
    });
  }
}
