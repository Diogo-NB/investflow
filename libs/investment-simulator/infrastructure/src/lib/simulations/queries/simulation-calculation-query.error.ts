import { AppError, EAppErrorCode } from '@investflow/shared-domain';

export class SimulationCalculationQueryError extends AppError {
  constructor(cause: unknown) {
    super('Não foi possível carregar os cálculos.', {
      code: EAppErrorCode.SIMULATION_CALCULATION_QUERY_FAILED,
      kind: 'infrastructure',
      cause,
    });
  }
}
