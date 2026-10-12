import { CreateOfferCommandInput } from '../../offers/shared/offer-command-input.type';

// Exactly one of them: a visible offer, or terms for a new private offer.
export interface SimulationOfferCommandInput {
  readonly id?: string;
  readonly new?: CreateOfferCommandInput;
}

export interface InvestmentCommandInput {
  readonly principal: string;
  readonly investmentDate: string;
  readonly curveId?: string | null;
}

export interface CreateSimulationCommandInput {
  readonly offer: SimulationOfferCommandInput;
  readonly investment: InvestmentCommandInput;
}

export interface EditSimulationCommandInput
  extends CreateSimulationCommandInput {
  readonly revision: number;
}

export interface SimulationIdCommandInput {
  readonly simulationId: string;
}
