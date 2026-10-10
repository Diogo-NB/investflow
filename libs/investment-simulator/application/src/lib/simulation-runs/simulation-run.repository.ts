import { SimulationRun } from '@investflow/investment-simulator-domain';
import { Repository } from '@investflow/shared-domain';

// Append-only: saving an already recorded run is a persistence failure.
export abstract class SimulationRunRepository extends Repository<SimulationRun> {}
