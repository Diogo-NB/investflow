import {
  RedemptionTermsCommandInput,
  RemunerationTermsCommandInput,
} from '../../offers/shared/offer-command-input.type';

// Optional experiment overrides applied to the captured offer conditions.
export interface ApplicationTermsCommandInput {
  readonly maturityDate?: string;
  readonly redemptionTerms?: RedemptionTermsCommandInput;
  readonly remunerationTerms?: RemunerationTermsCommandInput;
}

export interface ApplicationInvestmentCommandInput
  extends ApplicationTermsCommandInput {
  readonly principal: string;
  readonly investmentDate: string;
  readonly indexCurveId?: string | null;
}

export interface CreateApplicationCommandInput
  extends ApplicationInvestmentCommandInput {
  readonly offerId: string;
}

export interface ApplicationIdCommandInput {
  readonly applicationId: string;
}
