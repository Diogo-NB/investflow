import {
  ETitleType,
  RedemptionTerms,
  SimulationResult,
} from '@investflow/investment-simulator-domain';
import { InputFingerprint } from '@investflow/shared-domain';
import type { TransactionalPrismaClient } from '@investflow/shared-infrastructure';

export interface SimulationPremiseIds {
  readonly revision: number;
  readonly offerId: string;
  readonly curveId: string | null;
}

// What the screens and the oracle compare a result with under V2 and V3: the
// copy's revisions, as a service that knows only its copy would. A premise
// with no copy row yet counts as unread, so its results show as outdated
// until the copy catches up.
export class PremiseCopyRevisions {
  private constructor(
    private readonly offers: ReadonlyMap<
      string,
      {
        readonly titleType: ETitleType;
        readonly termsRevision: number;
        readonly redemptionType: 'AT_MATURITY' | 'DAILY';
      }
    >,
    private readonly curves: ReadonlyMap<string, number>,
  ) {}

  static async load(
    client: TransactionalPrismaClient,
    simulations: readonly SimulationPremiseIds[],
  ): Promise<PremiseCopyRevisions> {
    const offerIds = [...new Set(simulations.map(({ offerId }) => offerId))];
    const curveIds = [
      ...new Set(
        simulations.flatMap(({ curveId }) => (curveId ? [curveId] : [])),
      ),
    ];
    const [offers, curves] = await Promise.all([
      client.offerCopy.findMany({
        where: { offerId: { in: offerIds }, isDeleted: false },
        select: {
          offerId: true,
          titleType: true,
          termsRevision: true,
          redemptionType: true,
        },
      }),
      client.curveCopy.findMany({
        where: { curveId: { in: curveIds }, isDeleted: false },
        select: { curveId: true, valuesRevision: true },
      }),
    ]);
    return new PremiseCopyRevisions(
      new Map(
        offers.map(({ offerId, titleType, termsRevision, redemptionType }) => [
          offerId,
          {
            titleType: titleType as ETitleType,
            termsRevision,
            redemptionType,
          },
        ]),
      ),
      new Map(
        curves.map(({ curveId, valuesRevision }) => [curveId, valuesRevision]),
      ),
    );
  }

  currentInputFingerprintOf(
    simulation: SimulationPremiseIds,
  ): InputFingerprint {
    const offer = this.offers.get(simulation.offerId) ?? null;
    return SimulationResult.inputFingerprintFor({
      simulationRevision: simulation.revision,
      offer,
      curveValuesRevision: simulation.curveId
        ? (this.curves.get(simulation.curveId) ?? null)
        : null,
    });
  }

  // A placeholder while the copy has no row: only the plan's totals read it.
  redemptionTermsOf(offerId: string): RedemptionTerms {
    return RedemptionTerms.create(
      this.offers.get(offerId)?.redemptionType ?? 'AT_MATURITY',
    );
  }
}
