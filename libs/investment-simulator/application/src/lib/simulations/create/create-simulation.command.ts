import { InvestmentInputs } from '@investflow/investment-simulator-domain';
import { CalendarDate, Money } from '@investflow/shared-domain';
import {
  CreateSimulationCommandInput,
  InvestmentCommandInput,
} from '../shared/simulation-command-input.type';

export class CreateSimulationCommand {
  private constructor(
    readonly ownerId: string,
    readonly offerId: string,
    readonly investment: InvestmentInputs,
  ) {}

  static fromRequest(
    ownerId: string,
    request: CreateSimulationCommandInput,
  ): CreateSimulationCommand {
    return new CreateSimulationCommand(
      ownerId,
      request.offerId,
      CreateSimulationCommand.toInvestment(request.investment),
    );
  }

  static toInvestment(investment: InvestmentCommandInput): InvestmentInputs {
    return InvestmentInputs.create({
      principal: Money.of(investment.principal),
      investmentDate: CalendarDate.of(investment.investmentDate),
      curveId: investment.curveId ?? null,
    });
  }
}
