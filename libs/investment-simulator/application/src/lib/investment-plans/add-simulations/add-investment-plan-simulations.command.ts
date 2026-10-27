import {
  AddInvestmentPlanSimulationsCommandInput,
  InvestmentPlanIdCommandInput,
} from '../shared/investment-plan-command-input.type';

export class AddInvestmentPlanSimulationsCommand {
  private constructor(
    readonly ownerId: string,
    readonly investmentPlanId: string,
    readonly simulationIds: readonly string[],
  ) {}

  static fromRequest(
    ownerId: string,
    params: InvestmentPlanIdCommandInput,
    request: AddInvestmentPlanSimulationsCommandInput,
  ): AddInvestmentPlanSimulationsCommand {
    return new AddInvestmentPlanSimulationsCommand(
      ownerId,
      params.investmentPlanId,
      request.simulationIds,
    );
  }
}
