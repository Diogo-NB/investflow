import { NotFoundError } from '@investflow/shared-domain';

export class SimulationRunNotFoundError extends NotFoundError {
  constructor(runId: string) {
    super(`Simulation run ${runId} was not found`, {
      code: 'SIMULATION_RUN_NOT_FOUND',
      metadata: { runId },
    });
  }
}
