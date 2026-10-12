import {
  ConflictError,
  DomainError,
  EAppErrorCode,
} from '@investflow/shared-domain';

export class SimulationDeletedError extends DomainError {
  constructor(simulationId: string) {
    super('Simulações excluídas não podem ser alteradas.', {
      code: EAppErrorCode.SIMULATION_DELETED,
      kind: 'conflict',
      metadata: { simulationId },
    });
  }
}

export class SimulationRevisionConflictError extends ConflictError {
  constructor(id: string, expectedRevision: number) {
    super(
      'Esta simulação foi alterada em outro lugar. Recarregue e tente novamente.',
      {
        code: EAppErrorCode.SIMULATION_REVISION_CONFLICT,
        metadata: { id, expectedRevision },
      },
    );
  }
}
