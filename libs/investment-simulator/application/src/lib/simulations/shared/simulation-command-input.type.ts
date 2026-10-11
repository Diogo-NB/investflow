import { ETitleType } from '@investflow/investment-simulator-domain';
import {
  RedemptionTermsCommandInput,
  RemunerationTermsCommandInput,
} from '../../offers/shared/offer-command-input.type';

export interface SimulationTermsCommandInput {
  readonly titleType: ETitleType;
  readonly issuerId?: string | null;
  readonly maturityDate: string;
  readonly redemptionTerms: RedemptionTermsCommandInput;
  readonly remunerationTerms: RemunerationTermsCommandInput;
}

export interface InvestmentCommandInput {
  readonly principal: string;
  readonly investmentDate: string;
  readonly indexCurveId?: string | null;
}

export interface StartSimulationCommandInput {
  // The catalog offer the terms were filled from.
  readonly offerId?: string;
  readonly terms: SimulationTermsCommandInput;
  readonly investment: InvestmentCommandInput;
}

export interface SimulationIdCommandInput {
  readonly simulationId: string;
}
