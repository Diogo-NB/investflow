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
  readonly issuerId?: string | null;
  readonly maturityDate: string;
  readonly redemptionTerms: RedemptionTermsCommandInput;
  readonly remunerationTerms: RemunerationTermsCommandInput;
}

export interface UpdateOfferCommandInput {
  readonly maturityDate?: string;
  readonly redemptionTerms?: RedemptionTermsCommandInput;
  readonly remunerationTerms?: RemunerationTermsCommandInput;
}

export interface OfferIdCommandInput {
  readonly offerId: string;
}
