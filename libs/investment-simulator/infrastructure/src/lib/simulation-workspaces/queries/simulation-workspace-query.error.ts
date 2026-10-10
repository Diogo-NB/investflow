import { AppError, EAppErrorCode } from '@investflow/shared-domain';

export class SimulationWorkspaceQueryError extends AppError {
  constructor(cause: unknown) {
    super('Não foi possível carregar a simulação.', {
      code: EAppErrorCode.SIMULATION_WORKSPACE_QUERY_FAILED,
      kind: 'infrastructure',
      cause,
    });
  }
}
