import { InvestmentInputs } from '@investflow/investment-simulator-domain';
import { CalendarDate, Money } from '@investflow/shared-domain';
import { CreateOfferCommand } from '../../offers/create/create-offer.command';
import {
  CreateSimulationCommandInput,
  InvestmentCommandInput,
  SimulationOfferCommandInput,
} from '../shared/simulation-command-input.type';

export type SimulationOfferChoice =
  | { readonly kind: 'existing'; readonly offerId: string }
  | { readonly kind: 'new'; readonly offer: CreateOfferCommand };

export class CreateSimulationCommand {
  private constructor(
    readonly ownerId: string,
    readonly offer: SimulationOfferChoice,
    readonly investment: InvestmentInputs,
  ) {}

  static fromRequest(
    ownerId: string,
    request: CreateSimulationCommandInput,
  ): CreateSimulationCommand {
    return new CreateSimulationCommand(
      ownerId,
      CreateSimulationCommand.toOfferChoice(ownerId, request.offer),
      CreateSimulationCommand.toInvestment(request.investment),
    );
  }

  // The request boundary guarantees exactly one of id and new.
  static toOfferChoice(
    ownerId: string,
    offer: SimulationOfferCommandInput,
  ): SimulationOfferChoice {
    return offer.new
      ? {
          kind: 'new',
          offer: CreateOfferCommand.fromRequest(ownerId, offer.new),
        }
      : { kind: 'existing', offerId: offer.id ?? '' };
  }

  static toInvestment(investment: InvestmentCommandInput): InvestmentInputs {
    return InvestmentInputs.create({
      principal: Money.of(investment.principal),
      investmentDate: CalendarDate.of(investment.investmentDate),
      curveId: investment.curveId ?? null,
    });
  }
}
