import { EAppErrorCode, NotFoundError } from '@investflow/shared-domain';

export class SimulationCalculationNotFoundError extends NotFoundError {
  constructor(calculationId: string) {
    super('Este cálculo não existe mais.', {
      code: EAppErrorCode.SIMULATION_CALCULATION_NOT_FOUND,
      metadata: { calculationId },
    });
  }
}
