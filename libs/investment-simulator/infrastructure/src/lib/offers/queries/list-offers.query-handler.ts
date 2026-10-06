import { Injectable } from '@nestjs/common';
import { QueryHandler } from '@investflow/shared-application';
import type { PaginatedResult } from '@investflow/shared-types';
import { Result } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { InvestmentTitleType, Prisma } from '@prisma/client';
import { OfferQueryError } from './offer-query.error';
import {
  OfferReadModel,
  offerReadSelect,
  toOfferReadModel,
} from './offer-read-model.type';

export interface ListOffersQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly q?: string;
  readonly titleType?: InvestmentTitleType;
}

@Injectable()
export class ListOffersQueryHandler
  implements
    QueryHandler<
      ListOffersQuery,
      PaginatedResult<OfferReadModel>,
      OfferQueryError
    >
{
  constructor(private readonly prisma: PrismaService) {}

  execute(
    query: ListOffersQuery,
  ): Promise<Result<PaginatedResult<OfferReadModel>, OfferQueryError>> {
    return Result.fromPromise(
      async () => {
        const where: Prisma.InvestmentOfferWhereInput = {
          deletedAt: null,
          ...(query.titleType ? { titleType: query.titleType } : {}),
          ...(query.q
            ? { issuer: { name: { contains: query.q, mode: 'insensitive' } } }
            : {}),
        };
        const [records, total] = await Promise.all([
          this.prisma.client.investmentOffer.findMany({
            where,
            select: offerReadSelect,
            orderBy: [{ maturityDate: 'asc' }, { id: 'asc' }],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
          }),
          this.prisma.client.investmentOffer.count({ where }),
        ]);
        return {
          items: records.map(toOfferReadModel),
          total,
          page: query.page,
          pageSize: query.pageSize,
        };
      },
      (cause) => new OfferQueryError(cause),
    );
  }
}
