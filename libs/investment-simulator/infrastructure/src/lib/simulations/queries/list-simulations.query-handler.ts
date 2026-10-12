import { Injectable } from '@nestjs/common';
import { QueryHandler } from '@investflow/shared-application';
import type { PaginatedResult } from '@investflow/shared-types';
import {
  ETitleType,
  SimulationResult,
} from '@investflow/investment-simulator-domain';
import { CalendarDate, Result } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { Prisma } from '@prisma/client';
import { SimulationQueryError } from './simulation-query.error';

export interface ListSimulationsQuery {
  readonly ownerId: string;
  readonly page: number;
  readonly pageSize: number;
}

// Terms come from the offer the simulation uses.
export interface SimulationListItem {
  readonly id: string;
  readonly offerName: string;
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
  // Null until the first successful calculation.
  readonly result: {
    readonly calculatedAt: string;
    readonly outdated: boolean;
    readonly netBalance: string;
  } | null;
}

export type ListSimulationsOutput = PaginatedResult<SimulationListItem>;

const simulationSelect = {
  id: true,
  revision: true,
  principal: true,
  investmentDate: true,
  offer: {
    select: {
      name: true,
      titleType: true,
      issuerName: true,
      maturityDate: true,
      remunerationType: true,
      rateValue: true,
      revision: true,
    },
  },
  curve: { select: { revision: true } },
  result: {
    select: {
      simulationRevision: true,
      offerRevision: true,
      curveRevision: true,
      methodologyVersion: true,
      calculatedAt: true,
      netBalance: true,
    },
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
    const { offer, result } = record;
    return {
      id: record.id,
      offerName: offer.name,
      principal: record.principal.toFixed(),
      investmentDate: CalendarDate.fromUtcDate(
        record.investmentDate,
      ).value.toIsoString(),
      maturityDate: CalendarDate.fromUtcDate(
        offer.maturityDate,
      ).value.toIsoString(),
      titleType: offer.titleType,
      issuerName: offer.issuerName,
      remunerationTerms: {
        kind: offer.remunerationType,
        rate: offer.rateValue.toFixed(),
      },
      result: result
        ? {
            calculatedAt: result.calculatedAt.toISOString(),
            outdated: !SimulationResult.isCurrent(
              result,
              SimulationResult.targetFor(
                record.revision,
                offer.titleType as ETitleType,
                offer.revision,
                record.curve?.revision ?? null,
              ),
            ),
            netBalance: result.netBalance.toFixed(),
          }
        : null,
    };
  }
}
