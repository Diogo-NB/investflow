import { ComparedSimulation } from '@investflow/investment-simulator-domain';
import { AppError, Result } from '@investflow/shared-domain';

// An owner's live simulations, as a comparison sees them.
export abstract class ComparedSimulationReader {
  // Keyed by id; another owner's, a deleted, or an unknown simulation is left
  // out.
  abstract findOwned(
    ownerId: string,
    simulationIds: readonly string[],
  ): Promise<Result<ReadonlyMap<string, ComparedSimulation>, AppError>>;
}
