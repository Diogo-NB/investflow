import { Simulation } from '@investflow/investment-simulator-domain';
import { AppError, Result } from '@investflow/shared-domain';

// A deleted simulation is reported as missing.
export abstract class SimulationRepository {
  // For the calculation worker, which acts for no user.
  abstract findById(id: string): Promise<Result<Simulation, AppError>>;

  // Another owner's simulation is reported as missing too.
  abstract findOwned(
    id: string,
    ownerId: string,
  ): Promise<Result<Simulation, AppError>>;

  abstract save(simulation: Simulation): Promise<Result<void, AppError>>;
}
