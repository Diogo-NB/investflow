import { AppError, EAppErrorCode } from '@investflow/shared-domain';

export class SimulationComparisonQueryError extends AppError {
  constructor(cause: unknown) {
    super('Não foi possível carregar a comparação.', {
      code: EAppErrorCode.SIMULATION_COMPARISON_QUERY_FAILED,
      kind: 'infrastructure',
      cause,
    });
  }
}
