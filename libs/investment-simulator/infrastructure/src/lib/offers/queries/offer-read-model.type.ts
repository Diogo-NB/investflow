import { CalendarDate } from '@investflow/shared-domain';
import {
  InvestmentTitleType,
  InvestmentRedemptionType,
  InvestmentRemunerationType,
  Prisma,
} from '@prisma/client';

export interface OfferReadModel {
  readonly id: string;
  readonly titleType: InvestmentTitleType;
  readonly issuer: { readonly id: string; readonly name: string };
  readonly maturityDate: CalendarDate;
  readonly redemptionTerms: { readonly kind: InvestmentRedemptionType };
  readonly remunerationTerms: {
    readonly kind: InvestmentRemunerationType;
    readonly rate: string;
  };
}

export const offerReadSelect = {
  id: true,
  titleType: true,
  issuer: { select: { id: true, name: true } },
  maturityDate: true,
  redemptionType: true,
  remunerationType: true,
  rateValue: true,
} satisfies Prisma.InvestmentOfferSelect;

export function toOfferReadModel(
  record: Prisma.InvestmentOfferGetPayload<{ select: typeof offerReadSelect }>,
): OfferReadModel {
  return {
    id: record.id,
    titleType: record.titleType,
    issuer: record.issuer,
    maturityDate: CalendarDate.fromUtcDate(record.maturityDate).value,
    redemptionTerms: { kind: record.redemptionType },
    remunerationTerms: {
      kind: record.remunerationType,
      rate: record.rateValue.toFixed(),
    },
  };
}
