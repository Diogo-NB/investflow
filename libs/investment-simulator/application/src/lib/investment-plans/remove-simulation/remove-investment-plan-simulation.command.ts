import { InvestmentPlanSimulationIdCommandInput } from '../shared/investment-plan-command-input.type';

export class RemoveInvestmentPlanSimulationCommand {
  private constructor(
    readonly ownerId: string,
    readonly investmentPlanId: string,
    readonly simulationId: string,
  ) {}

  static fromRequest(
    ownerId: string,
    params: InvestmentPlanSimulationIdCommandInput,
  ): RemoveInvestmentPlanSimulationCommand {
    return new RemoveInvestmentPlanSimulationCommand(
      ownerId,
      params.investmentPlanId,
      params.simulationId,
    );
  }
}
