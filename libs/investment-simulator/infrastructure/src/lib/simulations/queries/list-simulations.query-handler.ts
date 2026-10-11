import { Injectable } from '@nestjs/common';
import { QueryHandler } from '@investflow/shared-application';
import type { PaginatedResult } from '@investflow/shared-types';
import { SimulationCalculation } from '@investflow/investment-simulator-domain';
import { CalendarDate, Result } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { Prisma } from '@prisma/client';
import { SimulationQueryError } from './simulation-query.error';

export interface ListSimulationsQuery {
  readonly ownerId: string;
  readonly page: number;
  readonly pageSize: number;
}

// Terms come from the simulation; the investment and result from its latest
// calculation.
export interface SimulationListItem {
  readonly id: string;
  readonly fromCatalogOffer: boolean;
  readonly principal: string;
  readonly investmentDate: string;
  readonly maturityDate: string;
  readonly titleType: 'CDB' | 'LCI' | 'LCA';
  readonly issuerName: string | null;
  readonly remunerationTerms: {
    readonly kind:
      | 'PREFIXED'
      | 'IPCA_PLUS'
      | 'CDI_PERCENTAGE'
      | 'SELIC_PERCENTAGE';
    readonly rate: string;
  };
  readonly latestCalculation: {
    readonly id: string;
    readonly calculatedAt: string;
    readonly outdated: boolean;
    readonly netBalance: string;
  };
}

export type ListSimulationsOutput = PaginatedResult<SimulationListItem>;

const simulationSelect = {
  id: true,
  sourceOfferId: true,
  maturityDate: true,
  titleType: true,
  issuer: { select: { name: true } },
  remunerationType: true,
  rateValue: true,
  calculations: {
    select: {
      id: true,
      calculatedAt: true,
      methodologyVersion: true,
      netBalance: true,
      principal: true,
      investmentDate: true,
    },
    orderBy: { calculatedAt: 'desc' },
    take: 1,
  },
} satisfies Prisma.SimulationSelect;

type SimulationRecord = Prisma.SimulationGetPayload<{
  select: typeof simulationSelect;
}>;

@Injectable()
export class ListSimulationsQueryHandler
  implements QueryHandler<ListSimulationsQuery, ListSimulationsOutput>
{
  constructor(private readonly prisma: PrismaService) {}

  execute(
    query: ListSimulationsQuery,
  ): Promise<Result<ListSimulationsOutput, SimulationQueryError>> {
    return Result.fromPromise(
      async () => {
        const where: Prisma.SimulationWhereInput = {
          ownerId: query.ownerId,
          deletedAt: null,
        };
        const [records, total] = await Promise.all([
          this.prisma.client.simulation.findMany({
            where,
            select: simulationSelect,
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
          }),
          this.prisma.client.simulation.count({ where }),
        ]);
        return {
          items: records.map((record) => this.toOutput(record)),
          total,
          page: query.page,
          pageSize: query.pageSize,
        };
      },
      (cause) => new SimulationQueryError(cause),
    );
  }

  private toOutput(record: SimulationRecord): SimulationListItem {
    // A simulation is only created together with its first calculation.
    const [latest] = record.calculations;
    return {
      id: record.id,
      fromCatalogOffer: record.sourceOfferId !== null,
      principal: latest.principal.toFixed(),
      investmentDate: CalendarDate.fromUtcDate(
        latest.investmentDate,
      ).value.toIsoString(),
      maturityDate: CalendarDate.fromUtcDate(
        record.maturityDate,
      ).value.toIsoString(),
      titleType: record.titleType,
      issuerName: record.issuer?.name ?? null,
      remunerationTerms: {
        kind: record.remunerationType,
        rate: record.rateValue.toFixed(),
      },
      latestCalculation: {
        id: latest.id,
        calculatedAt: latest.calculatedAt.toISOString(),
        outdated: SimulationCalculation.isOutdated(latest.methodologyVersion),
        netBalance: latest.netBalance.toFixed(),
      },
    };
  }
}
