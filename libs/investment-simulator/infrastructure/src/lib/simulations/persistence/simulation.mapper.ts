import { Simulation } from '@investflow/investment-simulator-domain';
import { UtcInstant } from '@investflow/shared-domain';
import { Simulation as SimulationRecord } from '@prisma/client';

export interface SimulationPersistenceData {
  readonly id: string;
  readonly ownerId: string;
  readonly sourceOfferId: string | null;
  readonly deletedAt: Date | null;
}

export class SimulationMapper {
  static toDomain(record: SimulationRecord): Simulation {
    return Simulation.reconstitute({
      id: record.id,
      ownerId: record.ownerId,
      sourceOfferId: record.sourceOfferId,
      deletedAt: record.deletedAt
        ? UtcInstant.fromDate(record.deletedAt).value
        : null,
    });
  }

  static toPersistence(simulation: Simulation): SimulationPersistenceData {
    return {
      id: simulation.id,
      ownerId: simulation.ownerId,
      sourceOfferId: simulation.sourceOfferId,
      deletedAt: simulation.deletedAt?.date ?? null,
    };
  }
}
