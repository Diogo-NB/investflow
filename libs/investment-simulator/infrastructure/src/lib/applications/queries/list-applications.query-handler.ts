import { Injectable } from '@nestjs/common';
import { QueryHandler } from '@investflow/shared-application';
import type { PaginatedResult } from '@investflow/shared-types';
import { CalendarDate, Result } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { Prisma } from '@prisma/client';
import { ApplicationQueryError } from './application-query.error';

export interface ListApplicationsQuery {
  readonly ownerId: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface ApplicationListItem {
  readonly id: string;
  readonly principal: string;
  readonly investmentDate: string;
  readonly maturityDate: string;
  readonly titleType: 'CDB' | 'LCI' | 'LCA';
  readonly issuerName: string;
  readonly remunerationTerms: {
    readonly kind:
      | 'PREFIXED'
      | 'IPCA_PLUS'
      | 'CDI_PERCENTAGE'
      | 'SELIC_PERCENTAGE';
    readonly rate: string;
  };
}

export type ListApplicationsOutput = PaginatedResult<ApplicationListItem>;

const applicationSelect = {
  id: true,
  principal: true,
  investmentDate: true,
  offerSnapshot: {
    select: {
      titleType: true,
      issuer: { select: { name: true } },
      maturityDate: true,
      remunerationType: true,
      rateValue: true,
    },
  },
} satisfies Prisma.InvestmentApplicationSelect;

type ApplicationRecord = Prisma.InvestmentApplicationGetPayload<{
  select: typeof applicationSelect;
}>;

@Injectable()
export class ListApplicationsQueryHandler
  implements QueryHandler<ListApplicationsQuery, ListApplicationsOutput>
{
  constructor(private readonly prisma: PrismaService) {}

  execute(
    query: ListApplicationsQuery,
  ): Promise<Result<ListApplicationsOutput, ApplicationQueryError>> {
    return Result.fromPromise(
      async () => {
        const where: Prisma.InvestmentApplicationWhereInput = {
          ownerId: query.ownerId,
          deletedAt: null,
        };
        const [records, total] = await Promise.all([
          this.prisma.client.investmentApplication.findMany({
            where,
            select: applicationSelect,
            orderBy: [{ investmentDate: 'desc' }, { id: 'asc' }],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
          }),
          this.prisma.client.investmentApplication.count({ where }),
        ]);
        return {
          items: records.map((record) => this.toOutput(record)),
          total,
          page: query.page,
          pageSize: query.pageSize,
        };
      },
      (cause) => new ApplicationQueryError(cause),
    );
  }

  private toOutput(record: ApplicationRecord): ApplicationListItem {
    const offer = record.offerSnapshot;
    return {
      id: record.id,
      principal: record.principal.toFixed(),
      investmentDate: CalendarDate.fromUtcDate(
        record.investmentDate,
      ).value.toIsoString(),
      maturityDate: CalendarDate.fromUtcDate(
        offer.maturityDate,
      ).value.toIsoString(),
      titleType: offer.titleType,
      issuerName: offer.issuer.name,
      remunerationTerms: {
        kind: offer.remunerationType,
        rate: offer.rateValue.toFixed(),
      },
    };
  }
}
