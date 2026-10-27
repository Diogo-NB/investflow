import {
  EditInvestmentPlanCommandInput,
  InvestmentPlanIdCommandInput,
} from '../shared/investment-plan-command-input.type';

export class EditInvestmentPlanCommand {
  private constructor(
    readonly ownerId: string,
    readonly investmentPlanId: string,
    readonly revision: number,
    readonly name?: string,
    readonly description?: string | null,
  ) {}

  static fromRequest(
    ownerId: string,
    params: InvestmentPlanIdCommandInput,
    request: EditInvestmentPlanCommandInput,
  ): EditInvestmentPlanCommand {
    return new EditInvestmentPlanCommand(
      ownerId,
      params.investmentPlanId,
      request.revision,
      request.name,
      request.description,
    );
  }
}
