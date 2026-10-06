export const titleTypes = ['CDB', 'LCI', 'LCA'] as const;
export type TitleType = (typeof titleTypes)[number];
export type RedemptionKind = 'AT_MATURITY' | 'DAILY';
export type RemunerationKind =
  | 'PREFIXED'
  | 'CDI_PERCENTAGE'
  | 'SELIC_PERCENTAGE'
  | 'IPCA_PLUS';
export interface Issuer {
  readonly id: string;
  readonly name: string;
}
export interface Offer {
  readonly id: string;
  readonly titleType: TitleType;
  readonly issuer: Issuer;
  readonly maturityDate: string;
  readonly redemptionTerms: { readonly kind: RedemptionKind };
  readonly remunerationTerms: {
    readonly kind: RemunerationKind;
    readonly rate: string;
  };
}
export interface OfferFilters {
  readonly q: string;
  readonly titleType: TitleType | '';
  readonly page: number;
}
export interface CreateOffer {
  readonly titleType: TitleType;
  readonly issuerId: string;
  readonly maturityDate: string;
  readonly redemptionTerms: Offer['redemptionTerms'];
  readonly remunerationTerms: Offer['remunerationTerms'];
}
export type UpdateOffer = Partial<
  Pick<CreateOffer, 'maturityDate' | 'redemptionTerms' | 'remunerationTerms'>
>;
export interface OfferFormModel {
  titleType: TitleType | '';
  issuerId: string;
  maturityDate: string;
  redemptionKind: RedemptionKind | '';
  remunerationKind: RemunerationKind | '';
  percentage: string;
}
export type OperationState =
  | { readonly status: 'idle' }
  | { readonly status: 'pending' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'success'; readonly id?: string };
