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
  readonly offerId?: string;
  readonly curveId?: string;
  readonly titleType?: 'CDB' | 'LCI' | 'LCA';
  readonly remunerationKind?:
    | 'PREFIXED'
    | 'IPCA_PLUS'
    | 'CDI_PERCENTAGE'
    | 'SELIC_PERCENTAGE';
  readonly calculationStatus?: 'PENDING' | 'CALCULATED' | 'INVALID' | 'FAILED';
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
  readonly calculationStatus: 'PENDING' | 'CALCULATED' | 'INVALID' | 'FAILED';
  // The last successful calculation; null until the first one.
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
  calculation: { select: { status: true } },
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
        // A deleted offer or curve still matches its id, so the simulations
        // left without it can be counted and listed.
        const where: Prisma.SimulationWhereInput = {
          AND: [
            { ownerId: query.ownerId, deletedAt: null },
            query.offerId ? { offerId: query.offerId } : {},
            query.curveId ? { curveId: query.curveId } : {},
            query.titleType ? { offer: { titleType: query.titleType } } : {},
            query.remunerationKind
              ? { offer: { remunerationType: query.remunerationKind } }
              : {},
            query.calculationStatus
              ? { calculation: { status: query.calculationStatus } }
              : {},
          ],
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
    const { offer, result, calculation } = record;
    if (!calculation) {
      throw new Error(`Simulation ${record.id} without a calculation row`);
    }
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
      calculationStatus: calculation.status,
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
