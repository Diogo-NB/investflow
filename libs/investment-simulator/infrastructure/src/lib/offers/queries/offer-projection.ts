import { CalendarDate } from '@investflow/shared-domain';
import { Prisma } from '@prisma/client';

// Shared by the offer queries and the simulation options, which show offers
// the same way.

export type OfferOrigin = 'SYSTEM' | 'OWN';

export interface OfferSummary {
  readonly id: string;
  readonly titleType: 'CDB' | 'LCI' | 'LCA';
  readonly name: string;
  readonly issuerName: string | null;
  readonly maturityDate: string;
  readonly redemptionTerms: { readonly kind: 'AT_MATURITY' | 'DAILY' };
  readonly remunerationTerms: {
    readonly kind:
      | 'PREFIXED'
      | 'IPCA_PLUS'
      | 'CDI_PERCENTAGE'
      | 'SELIC_PERCENTAGE';
    readonly rate: string;
  };
  readonly origin: OfferOrigin;
  readonly revision: number;
}

// A user sees system offers and their own.
export function visibleOfferWhere(viewerId: string): Prisma.OfferWhereInput {
  return { deletedAt: null, OR: [{ ownerId: null }, { ownerId: viewerId }] };
}

export const offerSummarySelect = {
  id: true,
  titleType: true,
  name: true,
  issuerName: true,
  maturityDate: true,
  redemptionType: true,
  remunerationType: true,
  rateValue: true,
  ownerId: true,
  revision: true,
} satisfies Prisma.OfferSelect;

// By title type, system offers first, then the user's, each by name.
export const offerSummaryOrder: Prisma.OfferOrderByWithRelationInput[] = [
  { titleType: 'asc' },
  { ownerId: { sort: 'asc', nulls: 'first' } },
  { name: 'asc' },
  { id: 'asc' },
];

export type OfferSummaryRecord = Prisma.OfferGetPayload<{
  select: typeof offerSummarySelect;
}>;

export function toOfferSummary(record: OfferSummaryRecord): OfferSummary {
  return {
    id: record.id,
    titleType: record.titleType,
    name: record.name,
    issuerName: record.issuerName,
    maturityDate: CalendarDate.fromUtcDate(
      record.maturityDate,
    ).value.toIsoString(),
    redemptionTerms: { kind: record.redemptionType },
    remunerationTerms: {
      kind: record.remunerationType,
      rate: record.rateValue.toFixed(),
    },
    origin: record.ownerId ? 'OWN' : 'SYSTEM',
    revision: record.revision,
  };
}
