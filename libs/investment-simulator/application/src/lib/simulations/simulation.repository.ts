import { Simulation } from '@investflow/investment-simulator-domain';
import { AppError, Repository, Result } from '@investflow/shared-domain';

// A deleted simulation is reported as missing. findById is for the
// calculation worker, which acts for no user.
export abstract class SimulationRepository extends Repository<Simulation> {
  // Another owner's simulation is reported as missing too.
  abstract findOwned(
    id: string,
    ownerId: string,
  ): Promise<Result<Simulation, AppError>>;

  // The live simulations whose calculation reads the offer or curve.
  abstract findIdsByOffer(offerId: string): Promise<Result<string[], AppError>>;

  abstract findIdsByCurve(curveId: string): Promise<Result<string[], AppError>>;

  // The live simulations among ids that the owner has.
  abstract findIdsOwnedBy(
    ownerId: string,
    ids: readonly string[],
  ): Promise<Result<string[], AppError>>;
}
