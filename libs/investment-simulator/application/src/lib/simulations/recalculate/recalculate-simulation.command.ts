import { SimulationIdCommandInput } from '../shared/simulation-command-input.type';

export class RecalculateSimulationCommand {
  private constructor(
    readonly ownerId: string,
    readonly simulationId: string,
  ) {}

  static fromRequest(
    ownerId: string,
    params: SimulationIdCommandInput,
  ): RecalculateSimulationCommand {
    return new RecalculateSimulationCommand(ownerId, params.simulationId);
  }
}
