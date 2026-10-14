import { Injectable } from '@nestjs/common';
import { QueryHandler } from '@investflow/shared-application';
import type { PaginatedResult } from '@investflow/shared-types';
import { Result } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { Prisma } from '@prisma/client';
import { OfferQueryError } from './offer-query.error';
import {
  OfferOrigin,
  OfferSummary,
  offerSummaryOrder,
  offerSummarySelect,
  toOfferSummary,
  visibleOfferWhere,
} from './offer-projection';

export interface ListOffersQuery {
  readonly viewerId: string;
  readonly page: number;
  readonly pageSize: number;
  // Matches the name or the issuer.
  readonly q?: string;
  readonly titleType?: 'CDB' | 'LCI' | 'LCA';
  readonly origin?: OfferOrigin;
}

export type ListOffersOutput = PaginatedResult<OfferSummary>;

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
        const where: Prisma.OfferWhereInput = {
          AND: [
            visibleOfferWhere(query.viewerId),
            query.titleType ? { titleType: query.titleType } : {},
            query.origin
              ? { ownerId: query.origin === 'OWN' ? query.viewerId : null }
              : {},
            query.q
              ? {
                  OR: [
                    { name: { contains: query.q, mode: 'insensitive' } },
                    { issuerName: { contains: query.q, mode: 'insensitive' } },
                  ],
                }
              : {},
          ],
        };
        const [records, total] = await Promise.all([
          this.prisma.client.offer.findMany({
            where,
            select: offerSummarySelect,
            orderBy: offerSummaryOrder,
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
          }),
          this.prisma.client.offer.count({ where }),
        ]);
        return {
          items: records.map((record) => toOfferSummary(record)),
          total,
          page: query.page,
          pageSize: query.pageSize,
        };
      },
      (cause) => new OfferQueryError(cause),
    );
  }
}
