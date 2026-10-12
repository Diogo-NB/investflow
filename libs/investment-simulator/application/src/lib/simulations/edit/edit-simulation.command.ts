import { InvestmentInputs } from '@investflow/investment-simulator-domain';
import {
  CreateSimulationCommand,
  SimulationOfferChoice,
} from '../create/create-simulation.command';
import {
  EditSimulationCommandInput,
  SimulationIdCommandInput,
} from '../shared/simulation-command-input.type';

export class EditSimulationCommand {
  private constructor(
    readonly ownerId: string,
    readonly simulationId: string,
    readonly revision: number,
    readonly offer: SimulationOfferChoice,
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
      CreateSimulationCommand.toOfferChoice(ownerId, request.offer),
      CreateSimulationCommand.toInvestment(request.investment),
    );
  }
}
