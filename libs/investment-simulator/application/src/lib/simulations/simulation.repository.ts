import { Simulation } from '@investflow/investment-simulator-domain';
import { AppError, Result } from '@investflow/shared-domain';

export abstract class SimulationRepository {
  // Scoped to the owner: another owner's or a deleted simulation is reported
  // as missing.
  abstract findById(
    id: string,
    ownerId: string,
  ): Promise<Result<Simulation, AppError>>;

  abstract save(simulation: Simulation): Promise<Result<void, AppError>>;
}
