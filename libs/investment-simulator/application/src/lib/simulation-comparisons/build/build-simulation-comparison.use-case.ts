import { Injectable } from '@nestjs/common';
import {
  ComparedSimulation,
  SimulationComparison,
} from '@investflow/investment-simulator-domain';
import { QueryHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { SimulationNotFoundError } from '../../simulations/simulation-not-found.error';
import { ComparedSimulationReader } from '../compared-simulation-reader.port';
import { BuildSimulationComparisonQuery } from './build-simulation-comparison.query';

// Every simulation must be the owner's and live, so a comparison never ranks
// fewer than it was asked for.
@Injectable()
export class BuildSimulationComparisonUseCase
  implements QueryHandler<BuildSimulationComparisonQuery, SimulationComparison>
{
  constructor(private readonly simulations: ComparedSimulationReader) {}

  async execute(
    query: BuildSimulationComparisonQuery,
  ): Promise<Result<SimulationComparison, AppError>> {
    const found = await this.simulations.findOwned(
      query.ownerId,
      query.simulationIds,
    );
    if (found.isErr()) return found;
    const missingId = query.simulationIds.find((id) => !found.value.has(id));
    if (missingId) return Result.err(new SimulationNotFoundError(missingId));
    return Result.ok(
      SimulationComparison.of(
        query.simulationIds.map(
          (id) => found.value.get(id) as ComparedSimulation,
        ),
      ),
    );
  }
}
