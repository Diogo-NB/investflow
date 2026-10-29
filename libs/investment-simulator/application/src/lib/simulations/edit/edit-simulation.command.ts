import { InvestmentInputs } from '@investflow/investment-simulator-domain';
import { CreateSimulationCommand } from '../create/create-simulation.command';
import {
  EditSimulationCommandInput,
  SimulationIdCommandInput,
} from '../shared/simulation-command-input.type';

export class EditSimulationCommand {
  private constructor(
    readonly ownerId: string,
    readonly simulationId: string,
    readonly revision: number,
    readonly offerId: string,
    readonly investment: InvestmentInputs,
  ) {}

  static fromRequest(
    ownerId: string,
    params: SimulationIdCommandInput,
    request: EditSimulationCommandInput,
  ): EditSimulationCommand {
    return new EditSimulationCommand(
      ownerId,
      params.simulationId,
      request.revision,
      request.offerId,
      CreateSimulationCommand.toInvestment(request.investment),
    );
  }
}
