import { SimulationIdCommandInput } from '../shared/simulation-command-input.type';

export class DeleteSimulationCommand {
  private constructor(
    readonly ownerId: string,
    readonly simulationId: string,
  ) {}

  static fromRequest(
    ownerId: string,
    params: SimulationIdCommandInput,
  ): DeleteSimulationCommand {
    return new DeleteSimulationCommand(ownerId, params.simulationId);
  }
}
