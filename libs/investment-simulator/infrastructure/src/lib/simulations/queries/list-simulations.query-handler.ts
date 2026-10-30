import { Injectable } from '@nestjs/common';
import { SimulationResultValidityReader } from '@investflow/investment-simulator-application';
import { SimulationResultValidity } from '@investflow/investment-simulator-domain';
import { QueryHandler } from '@investflow/shared-application';
import type { PaginatedResult } from '@investflow/shared-types';
import { AppError, CalendarDate, Result } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { Prisma } from '@prisma/client';
import { SimulationQueryError } from './simulation-query.error';

export interface ListSimulationsQuery {
  readonly ownerId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly offerId?: string;
  readonly curveId?: string;
  // Part of the offer's name or issuer, ignoring case.
  readonly q?: string;
  // Only the members of this plan; none when it was deleted.
  readonly investmentPlanId?: string;
  readonly titleType?: 'CDB' | 'LCI' | 'LCA';
  readonly remunerationKind?:
    | 'PREFIXED'
    | 'IPCA_PLUS'
    | 'CDI_PERCENTAGE'
    | 'SELIC_PERCENTAGE';
  readonly calculationStatus?: 'PENDING' | 'CALCULATED' | 'INVALID' | 'FAILED';
  // Newest first when omitted.
  readonly sort?: 'netAnnualReturn';
}

// Terms come from the offer the simulation uses.
export interface SimulationListItem {
  readonly id: string;
  readonly offerName: string | null;
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
  // Null for fixed rates; kept after deletion so the row can say so.
  readonly curve: { readonly name: string; readonly deleted: boolean } | null;
  readonly calculationStatus: 'PENDING' | 'CALCULATED' | 'INVALID' | 'FAILED';
  // Calculated from the current premises with nothing queued, so the result
  // shown is final.
  readonly isSettled: boolean;
  // The last successful calculation; null until the first one.
  readonly result: {
    readonly calculatedAt: string;
    readonly netBalance: string;
    // A fraction: 0.1028 is 10.28% a year.
    readonly netAnnualReturn: string;
  } | null;
}

export type ListSimulationsOutput = PaginatedResult<SimulationListItem>;

const simulationSelect = {
  id: true,
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
    },
  },
  curve: { select: { name: true, deletedAt: true } },
  calculation: { select: { status: true } },
  result: {
    select: {
      calculatedAt: true,
      netBalance: true,
      netAnnualReturn: true,
    },
  },
} satisfies Prisma.SimulationSelect;

type SimulationRecord = Prisma.SimulationGetPayload<{
  select: typeof simulationSelect;
}>;

const newestFirst: Prisma.SimulationOrderByWithRelationInput[] = [
  { createdAt: 'desc' },
  { id: 'asc' },
];

// The page depends only on stored columns: the status filter and the sort by
// net annual return include stale results. Whether each listed result holds
// comes from a read port in domain terms, once the page is known.
@Injectable()
export class ListSimulationsQueryHandler
  implements QueryHandler<ListSimulationsQuery, ListSimulationsOutput>
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly validities: SimulationResultValidityReader,
  ) {}

  async execute(
    query: ListSimulationsQuery,
  ): Promise<Result<ListSimulationsOutput, AppError>> {
    const page = await Result.fromPromise(
      async () => {
        // A deleted offer or curve still matches its id, so the simulations
        // left without it can be counted and listed.
        const where: Prisma.SimulationWhereInput = {
          AND: [
            { ownerId: query.ownerId, deletedAt: null },
            query.offerId ? { offerId: query.offerId } : {},
            query.curveId ? { curveId: query.curveId } : {},
            query.q
              ? {
                  offer: {
                    OR: [
                      { name: { contains: query.q, mode: 'insensitive' } },
                      {
                        issuerName: { contains: query.q, mode: 'insensitive' },
                      },
                    ],
                  },
                }
              : {},
            query.investmentPlanId
              ? {
                  investmentPlans: {
                    some: {
                      investmentPlanId: query.investmentPlanId,
                      investmentPlan: { deletedAt: null },
                    },
                  },
                }
              : {},
            query.titleType ? { offer: { titleType: query.titleType } } : {},
            query.remunerationKind
              ? { offer: { remunerationType: query.remunerationKind } }
              : {},
            query.calculationStatus
              ? { calculation: { status: query.calculationStatus } }
              : {},
          ],
        };
        const skip = (query.page - 1) * query.pageSize;
        const [records, total] = await Promise.all([
          query.sort === 'netAnnualReturn'
            ? this.findByNetAnnualReturn(where, skip, query.pageSize)
            : this.prisma.client.simulation.findMany({
                where,
                select: simulationSelect,
                orderBy: newestFirst,
                skip,
                take: query.pageSize,
              }),
          this.prisma.client.simulation.count({ where }),
        ]);
        return { records, total };
      },
      (cause) => new SimulationQueryError(cause),
    );
    if (page.isErr()) return page;
    const { records, total } = page.value;
    const validities = await this.validities.findOwned(
      query.ownerId,
      records.map(({ id }) => id),
    );
    if (validities.isErr()) return validities;
    return Result.fromThrowable(
      () => ({
        // A simulation deleted between the two reads is left out.
        items: records.flatMap((record) => {
          const validity = validities.value.get(record.id);
          return validity ? [this.toOutput(record, validity)] : [];
        }),
        total,
        page: query.page,
        pageSize: query.pageSize,
      }),
      (cause) => new SimulationQueryError(cause),
    );
  }

  // Ordering by the optional result alone would put simulations without one
  // first (PostgreSQL sorts NULL first when descending, and Prisma offers no
  // nulls option for relation fields), so they are paged as a second segment.
  private async findByNetAnnualReturn(
    where: Prisma.SimulationWhereInput,
    skip: number,
    take: number,
  ): Promise<SimulationRecord[]> {
    const withResult = { AND: [where, { result: { isNot: null } }] };
    const ranked = await this.prisma.client.simulation.count({
      where: withResult,
    });
    const rankedRecords =
      skip < ranked
        ? await this.prisma.client.simulation.findMany({
            where: withResult,
            select: simulationSelect,
            orderBy: [{ result: { netAnnualReturn: 'desc' } }, ...newestFirst],
            skip,
            take,
          })
        : [];
    const remaining = take - rankedRecords.length;
    if (remaining === 0) return rankedRecords;
    const unranked = await this.prisma.client.simulation.findMany({
      where: { AND: [where, { result: { is: null } }] },
      select: simulationSelect,
      orderBy: newestFirst,
      skip: Math.max(0, skip - ranked),
      take: remaining,
    });
    return [...rankedRecords, ...unranked];
  }

  private toOutput(
    record: SimulationRecord,
    validity: SimulationResultValidity,
  ): SimulationListItem {
    const { offer, curve, result, calculation } = record;
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
      curve: curve && { name: curve.name, deleted: curve.deletedAt !== null },
      calculationStatus: calculation.status,
      isSettled: validity.isSettled,
      result: result
        ? {
            calculatedAt: result.calculatedAt.toISOString(),
            netBalance: result.netBalance.toFixed(),
            netAnnualReturn: result.netAnnualReturn.toFixed(),
          }
        : null,
    };
  }
}
