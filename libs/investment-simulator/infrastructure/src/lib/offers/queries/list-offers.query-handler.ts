import { Injectable } from '@nestjs/common';
import { QueryHandler } from '@investflow/shared-application';
import type { PaginatedResult } from '@investflow/shared-types';
import { CalendarDate, Result } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { Prisma } from '@prisma/client';
import { OfferQueryError } from './offer-query.error';

export interface ListOffersQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly q?: string;
  readonly titleType?: 'CDB' | 'LCI' | 'LCA';
}

export interface OfferListItem {
  readonly id: string;
  readonly titleType: 'CDB' | 'LCI' | 'LCA';
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
}

export type ListOffersOutput = PaginatedResult<OfferListItem>;

const offerSelect = {
  id: true,
  titleType: true,
  issuerName: true,
  maturityDate: true,
  redemptionType: true,
  remunerationType: true,
  rateValue: true,
} satisfies Prisma.InvestmentOfferSelect;

type OfferRecord = Prisma.InvestmentOfferGetPayload<{
  select: typeof offerSelect;
}>;

@Injectable()
export class ListOffersQueryHandler
  implements QueryHandler<ListOffersQuery, ListOffersOutput>
{
  constructor(private readonly prisma: PrismaService) {}

  execute(
    query: ListOffersQuery,
  ): Promise<Result<ListOffersOutput, OfferQueryError>> {
    return Result.fromPromise(
      async () => {
        const where: Prisma.InvestmentOfferWhereInput = {
          deletedAt: null,
          ...(query.titleType ? { titleType: query.titleType } : {}),
          ...(query.q
            ? { issuerName: { contains: query.q, mode: 'insensitive' } }
            : {}),
        };
        const [records, total] = await Promise.all([
          this.prisma.client.investmentOffer.findMany({
            where,
            select: offerSelect,
            orderBy: [{ maturityDate: 'asc' }, { id: 'asc' }],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
          }),
          this.prisma.client.investmentOffer.count({ where }),
        ]);
        return {
          items: records.map((record) => this.toOutput(record)),
          total,
          page: query.page,
          pageSize: query.pageSize,
        };
      },
      (cause) => new OfferQueryError(cause),
    );
  }

  private toOutput(record: OfferRecord): OfferListItem {
    return {
      id: record.id,
      titleType: record.titleType,
      issuerName: record.issuerName,
      maturityDate: CalendarDate.fromUtcDate(
        record.maturityDate,
      ).value.toIsoString(),
      redemptionTerms: { kind: record.redemptionType },
      remunerationTerms: {
        kind: record.remunerationType,
        rate: record.rateValue.toFixed(),
      },
    };
  }
}
