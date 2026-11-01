import {
  RemunerationTerms,
  ETitleType,
} from '@investflow/investment-simulator-domain';

export type RedemptionTermsCommandInput = {
  readonly kind: 'AT_MATURITY' | 'DAILY';
};

export interface RemunerationTermsCommandInput {
  readonly kind: RemunerationTerms['kind'];
  readonly rate: string;
}

export interface CreateOfferCommandInput {
  readonly titleType: ETitleType;
  readonly name?: string | null;
  readonly issuerName?: string | null;
  readonly maturityDate: string;
  readonly redemptionTerms: RedemptionTermsCommandInput;
  readonly remunerationTerms: RemunerationTermsCommandInput;
}

export interface CreateSimulationScopedOfferCommandInput
  extends CreateOfferCommandInput {
  readonly basedOnOfferId?: string | null;
}

export interface OfferRevisionCommandInput {
  readonly revision: number;
}

export interface EditOfferCommandInput {
  readonly revision: number;
  readonly name?: string | null;
  readonly issuerName?: string | null;
  readonly maturityDate?: string;
  readonly redemptionTerms?: RedemptionTermsCommandInput;
  readonly remunerationTerms?: RemunerationTermsCommandInput;
}

export interface OfferIdCommandInput {
  readonly offerId: string;
}
