import { InvestmentPlanIdCommandInput } from '../shared/investment-plan-command-input.type';

export class DeleteInvestmentPlanCommand {
  private constructor(
    readonly ownerId: string,
    readonly investmentPlanId: string,
  ) {}

  static fromRequest(
    ownerId: string,
    params: InvestmentPlanIdCommandInput,
  ): DeleteInvestmentPlanCommand {
    return new DeleteInvestmentPlanCommand(ownerId, params.investmentPlanId);
  }
}
