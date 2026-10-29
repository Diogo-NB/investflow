import { SimulationResultValidity } from '@investflow/investment-simulator-domain';
import { AppError, Result } from '@investflow/shared-domain';

// Whether an owner's live simulations have a result that still holds.
export abstract class SimulationResultValidityReader {
  // Keyed by id; another owner's, a deleted, or an unknown simulation is left
  // out.
  abstract findOwned(
    ownerId: string,
    simulationIds: readonly string[],
  ): Promise<Result<ReadonlyMap<string, SimulationResultValidity>, AppError>>;
}
