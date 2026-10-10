import { DomainError, EAppErrorCode } from '@investflow/shared-domain';

export class SimulationDeletedError extends DomainError {
  constructor(simulationId: string) {
    super('Simulações excluídas não podem ser calculadas.', {
      code: EAppErrorCode.SIMULATION_DELETED,
      kind: 'conflict',
      metadata: { simulationId },
    });
  }
}
