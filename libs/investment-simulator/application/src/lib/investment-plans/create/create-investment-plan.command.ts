import { CreateInvestmentPlanCommandInput } from '../shared/investment-plan-command-input.type';

export class CreateInvestmentPlanCommand {
  private constructor(
    readonly ownerId: string,
    readonly name: string,
    readonly description: string | null,
  ) {}

  static fromRequest(
    ownerId: string,
    request: CreateInvestmentPlanCommandInput,
  ): CreateInvestmentPlanCommand {
    return new CreateInvestmentPlanCommand(
      ownerId,
      request.name,
      request.description ?? null,
    );
  }
}
