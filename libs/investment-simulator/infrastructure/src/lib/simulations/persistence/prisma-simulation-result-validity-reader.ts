import { Injectable } from '@nestjs/common';
import { SimulationResultValidityReader } from '@investflow/investment-simulator-application';
import {
  ESimulationCalculationStatus,
  ETitleType,
  SimulationResult,
  SimulationResultValidity,
} from '@investflow/investment-simulator-domain';
import { InputFingerprint, Result } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { Prisma } from '@prisma/client';
import { SimulationQueryError } from '../queries/simulation-query.error';

const resultValiditySelect = {
  id: true,
  revision: true,
  offer: { select: { titleType: true, termsRevision: true } },
  curve: { select: { valuesRevision: true } },
  calculation: { select: { status: true } },
  result: { select: { inputFingerprint: true } },
} satisfies Prisma.SimulationSelect;

type ResultValidityRecord = Prisma.SimulationGetPayload<{
  select: typeof resultValiditySelect;
}>;

// Reads at most the ids asked for: one workspace, or one page of the list.
@Injectable()
export class PrismaSimulationResultValidityReader
  implements SimulationResultValidityReader
{
  constructor(private readonly prisma: PrismaService) {}

  findOwned(
    ownerId: string,
    simulationIds: readonly string[],
  ): Promise<
    Result<ReadonlyMap<string, SimulationResultValidity>, SimulationQueryError>
  > {
    return Result.fromPromise(
      async () => {
        const records = await this.prisma.client.simulation.findMany({
          where: { id: { in: [...simulationIds] }, ownerId, deletedAt: null },
          select: resultValiditySelect,
        });
        return new Map(
          records.map((record) => [record.id, this.toDomain(record)]),
        );
      },
      (cause) => new SimulationQueryError(cause),
    );
  }

  private toDomain({
    id,
    revision,
    offer,
    curve,
    calculation,
    result,
  }: ResultValidityRecord): SimulationResultValidity {
    if (!calculation) {
      throw new Error(`Simulation ${id} without a calculation row`);
    }
    return SimulationResultValidity.create({
      calculationStatus: calculation.status as ESimulationCalculationStatus,
      currentInputFingerprint: SimulationResult.inputFingerprintFor({
        simulationRevision: revision,
        offer: {
          titleType: offer.titleType as ETitleType,
          termsRevision: offer.termsRevision,
        },
        curveValuesRevision: curve?.valuesRevision ?? null,
      }),
      resultInputFingerprint: result
        ? InputFingerprint.restore(result.inputFingerprint)
        : null,
    });
  }
}
