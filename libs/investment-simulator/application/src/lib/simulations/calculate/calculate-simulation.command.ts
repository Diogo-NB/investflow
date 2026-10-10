import {
  ETitleType,
  InvestmentTerms,
  RedemptionTerms,
  RemunerationTerms,
  SimulationInputs,
} from '@investflow/investment-simulator-domain';
import { CalendarDate, Money, Rate } from '@investflow/shared-domain';
import {
  CreateSimulationCommandInput,
  SimulationIdCommandInput,
  SimulationInputsCommandInput,
} from '../shared/simulation-command-input.type';

export type CalculateSimulationTarget =
  | { readonly simulationId: string }
  | { readonly sourceOfferId: string | null };

export class CalculateSimulationCommand {
  private constructor(
    readonly ownerId: string,
    readonly target: CalculateSimulationTarget,
    readonly inputs: SimulationInputs,
  ) {}

  static fromCreateRequest(
    ownerId: string,
    request: CreateSimulationCommandInput,
  ): CalculateSimulationCommand {
    return new CalculateSimulationCommand(
      ownerId,
      { sourceOfferId: request.offerId ?? null },
      CalculateSimulationCommand.inputsFrom(request),
    );
  }

  static fromRequest(
    ownerId: string,
    params: SimulationIdCommandInput,
    request: SimulationInputsCommandInput,
  ): CalculateSimulationCommand {
    return new CalculateSimulationCommand(
      ownerId,
      { simulationId: params.simulationId },
      CalculateSimulationCommand.inputsFrom(request),
    );
  }

  private static inputsFrom(
    request: SimulationInputsCommandInput,
  ): SimulationInputs {
    return SimulationInputs.create({
      terms: InvestmentTerms.create({
        // CDB is the only calculable title.
        titleType: ETitleType.CDB,
        issuerId: request.issuerId,
        maturityDate: CalendarDate.of(request.maturityDate),
        redemption: RedemptionTerms.create(request.redemptionTerms.kind),
        remuneration: RemunerationTerms.create(
          request.remunerationTerms.kind,
          Rate.of(request.remunerationTerms.rate),
        ),
      }),
      principal: Money.of(request.principal),
      investmentDate: CalendarDate.of(request.investmentDate),
      indexCurveId: request.indexCurveId ?? null,
    });
  }
}
