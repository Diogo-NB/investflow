import {
  RedemptionTermsCommandInput,
  RemunerationTermsCommandInput,
} from '../../offers/shared/offer-command-input.type';

export interface SimulationInputsCommandInput {
  readonly principal: string;
  readonly investmentDate: string;
  readonly indexCurveId?: string | null;
  readonly issuerId: string;
  readonly maturityDate: string;
  readonly redemptionTerms: RedemptionTermsCommandInput;
  readonly remunerationTerms: RemunerationTermsCommandInput;
}

export interface CreateSimulationCommandInput
  extends SimulationInputsCommandInput {
  // The catalog offer the terms were filled from.
  readonly offerId?: string;
}

export interface SimulationIdCommandInput {
  readonly simulationId: string;
}
