import { Prisma } from '@prisma/client';
import { PrismaSimulationRepository } from '../simulations/persistence/prisma-simulation.repository';

// Records an outcome over whatever revision is stored, so a calculation of
// an earlier revision can overwrite a later one.
export class RevisionUnguardedSimulationRepository extends PrismaSimulationRepository {
  protected override calculatedRevisionCondition(): Prisma.SimulationCalculationWhereInput {
    return {};
  }
}
