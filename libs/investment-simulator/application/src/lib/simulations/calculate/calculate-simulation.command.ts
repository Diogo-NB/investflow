import { InvestmentInputs } from '@investflow/investment-simulator-domain';
import { CalendarDate, Money } from '@investflow/shared-domain';
import {
  InvestmentCommandInput,
  SimulationIdCommandInput,
} from '../shared/simulation-command-input.type';

export class CalculateSimulationCommand {
  private constructor(
    readonly ownerId: string,
    readonly simulationId: string,
    readonly investment: InvestmentInputs,
  ) {}

  static fromRequest(
    ownerId: string,
    params: SimulationIdCommandInput,
    request: InvestmentCommandInput,
  ): CalculateSimulationCommand {
    return new CalculateSimulationCommand(
      ownerId,
      params.simulationId,
      InvestmentInputs.create({
        principal: Money.of(request.principal),
        investmentDate: CalendarDate.of(request.investmentDate),
        curveId: request.curveId ?? null,
      }),
    );
  }
}
