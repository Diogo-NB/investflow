import { Injectable } from '@nestjs/common';
import { ComparedSimulationReader } from '@investflow/investment-simulator-application';
import {
  ComparedSimulation,
  ESimulationCalculationStatus,
  ETitleType,
} from '@investflow/investment-simulator-domain';
import { CalendarDate, Money, Result } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { SimulationComparisonQueryError } from '../queries/simulation-comparison-query.error';

const comparedSimulationSelect = {
  id: true,
  revision: true,
  offer: { select: { titleType: true, termsRevision: true } },
  curve: { select: { valuesRevision: true } },
  calculation: { select: { status: true } },
  result: {
    select: {
      simulationRevision: true,
      offerTermsRevision: true,
      curveValuesRevision: true,
      methodologyVersion: true,
      principal: true,
      investmentDate: true,
      maturityDate: true,
      netBalance: true,
      netAnnualReturn: true,
    },
  },
} satisfies Prisma.SimulationSelect;

type ComparedSimulationRecord = Prisma.SimulationGetPayload<{
  select: typeof comparedSimulationSelect;
}>;

// Reads at most the ids asked for, which a comparison caps at
// SimulationComparison.MAX_SIMULATIONS.
@Injectable()
export class PrismaComparedSimulationReader
  implements ComparedSimulationReader
{
  constructor(private readonly prisma: PrismaService) {}

  findOwned(
    ownerId: string,
    simulationIds: readonly string[],
  ): Promise<
    Result<
      ReadonlyMap<string, ComparedSimulation>,
      SimulationComparisonQueryError
    >
  > {
    return Result.fromPromise(
      async () => {
        const records = await this.prisma.client.simulation.findMany({
          where: { id: { in: [...simulationIds] }, ownerId, deletedAt: null },
          select: comparedSimulationSelect,
        });
        return new Map(
          records.map((record) => [record.id, this.toDomain(record)]),
        );
      },
      (cause) => new SimulationComparisonQueryError(cause),
    );
  }

  private toDomain({
    id,
    revision,
    offer,
    curve,
    calculation,
    result,
  }: ComparedSimulationRecord): ComparedSimulation {
    if (!calculation) {
      throw new Error(`Simulation ${id} without a calculation row`);
    }
    return ComparedSimulation.create({
      id,
      calculationStatus: calculation.status as ESimulationCalculationStatus,
      simulationRevision: revision,
      titleType: offer.titleType as ETitleType,
      offerTermsRevision: offer.termsRevision,
      curveValuesRevision: curve?.valuesRevision ?? null,
      lastResult: result && {
        inputs: {
          simulationRevision: result.simulationRevision,
          offerTermsRevision: result.offerTermsRevision,
          curveValuesRevision: result.curveValuesRevision,
          methodologyVersion: result.methodologyVersion,
        },
        principal: Money.of(result.principal.toFixed()),
        investmentDate: CalendarDate.fromUtcDate(result.investmentDate).value,
        maturityDate: CalendarDate.fromUtcDate(result.maturityDate).value,
        netFinalBalance: Money.of(result.netBalance.toFixed()),
        netAnnualReturn: new Decimal(result.netAnnualReturn.toFixed()),
      },
    });
  }
}
