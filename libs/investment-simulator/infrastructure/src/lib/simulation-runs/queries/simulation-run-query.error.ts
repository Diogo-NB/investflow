import { AppError } from '@investflow/shared-domain';

export class SimulationRunQueryError extends AppError {
  constructor(cause: unknown) {
    super('Failed to read simulation runs', {
      code: 'SIMULATION_RUN_QUERY_FAILED',
      kind: 'infrastructure',
      cause,
    });
  }
}
