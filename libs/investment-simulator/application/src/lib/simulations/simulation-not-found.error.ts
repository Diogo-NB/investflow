import { EAppErrorCode, NotFoundError } from '@investflow/shared-domain';

export class SimulationNotFoundError extends NotFoundError {
  constructor(simulationId: string) {
    super('Esta simulação não existe mais.', {
      code: EAppErrorCode.SIMULATION_NOT_FOUND,
      metadata: { simulationId },
    });
  }
}
