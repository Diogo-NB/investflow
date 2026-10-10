import { AppError, EAppErrorCode } from '@investflow/shared-domain';

export class SimulationQueryError extends AppError {
  constructor(cause: unknown) {
    super('Não foi possível carregar as simulações.', {
      code: EAppErrorCode.SIMULATION_QUERY_FAILED,
      kind: 'infrastructure',
      cause,
    });
  }
}
