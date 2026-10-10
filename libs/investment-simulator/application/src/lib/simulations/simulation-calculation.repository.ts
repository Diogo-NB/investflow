import { SimulationCalculation } from '@investflow/investment-simulator-domain';
import { Repository } from '@investflow/shared-domain';

// Append-only: saving an already recorded calculation is a persistence failure.
export abstract class SimulationCalculationRepository extends Repository<SimulationCalculation> {}
