import type {
  RedemptionKind,
  RemunerationTerms,
  TitleType,
} from './offer-terms';

export type ContentOrigin = 'SYSTEM' | 'OWN';

export interface OfferSummary {
  readonly id: string;
  readonly titleType: TitleType;
  // The user's own label; the terms already identify the offer.
  readonly name: string | null;
  readonly issuerName: string | null;
  readonly maturityDate: string;
  readonly redemptionTerms: { readonly kind: RedemptionKind };
  readonly remunerationTerms: RemunerationTerms;
  readonly origin: ContentOrigin;
  readonly revision: number;
}

export interface OfferTermsInput {
  readonly titleType: TitleType;
  readonly name: string | null;
  readonly issuerName: string | null;
  readonly maturityDate: string;
  readonly redemptionTerms: { readonly kind: RedemptionKind };
  readonly remunerationTerms: RemunerationTerms;
}

// Omitted fields keep their value; a null name or issuer clears it.
export type OfferEdit = Partial<Omit<OfferTermsInput, 'titleType'>> & {
  readonly revision: number;
};
