import {
  CurveRepository,
  OfferRepository,
  SimulationRepository,
} from '@investflow/investment-simulator-application';
import {
  Curve,
  ESimulationCalculationStatus,
  InvestmentProjection,
  Offer,
  Simulation,
  SimulationCalculationOutcome,
  SimulationCalculationPremises,
  SimulationCalculationService,
  SimulationResultValidity,
} from '@investflow/investment-simulator-domain';
import { PremiseCopyRevisions } from '@investflow/investment-simulator-infrastructure';
import {
  AppError,
  InputFingerprint,
  Result,
  UtcInstant,
} from '@investflow/shared-domain';
import type { PrismaService } from '@investflow/shared-infrastructure';
import Decimal from 'decimal.js';

export enum ESimulationVerdict {
  CORRECT = 'correct',
  // Wrong, and an operator was told: the simulation FAILED, or a dead-letter
  // queue holds a message of the simulation, its offer, or its curve.
  WRONG_ALARMED = 'wrong-alarmed',
  // Wrong, with no alarm, but the simulation shows it is not settled
  // (pending, invalid, or a result older than its premises).
  WRONG_VISIBLE = 'wrong-visible',
  WRONG_SILENT = 'wrong-silent',
}

export interface SimulationJudgement {
  readonly simulationId: string;
  readonly verdict: ESimulationVerdict;
  readonly status: ESimulationCalculationStatus;
  readonly isSettled: boolean;
  readonly isDeadLettered: boolean;
  readonly referenceKind: SimulationCalculationOutcome['kind'];
  readonly divergentFields: readonly string[];
  readonly resultInputFingerprint: string | null;
  readonly currentInputFingerprint: string;
}

// The stored columns' scale; the reference is compared after rounding to it.
const STORED_DECIMAL_PLACES = 30;

const comparedFields: readonly {
  readonly name: string;
  readonly of: (projection: InvestmentProjection) => Decimal;
}[] = [
  { name: 'principal', of: (p) => p.principal.amount },
  { name: 'businessDays', of: (p) => new Decimal(p.term.businessDays) },
  { name: 'grossBalance', of: (p) => p.gross.finalBalance.amount },
  { name: 'grossEarnings', of: (p) => p.gross.earnings.amount },
  { name: 'iof', of: (p) => p.taxes.iof.amount.amount },
  { name: 'incomeTax', of: (p) => p.taxes.incomeTax.amount.amount },
  { name: 'totalTaxes', of: (p) => p.taxes.total.amount },
  { name: 'netBalance', of: (p) => p.net.finalBalance.amount },
  { name: 'grossAnnualReturn', of: (p) => p.gross.rateOfReturn.annual },
  { name: 'netAnnualReturn', of: (p) => p.net.rateOfReturn.annual },
];

// Judges each stored simulation result against the one the production code
// calculates from the simulation's current premises. Reads only: the
// reference stays in memory, so the judged database is left as it was.
// Offers and curves are read once per judgement, since many simulations
// share them. Whether a result is settled is judged as the screen shows it:
// under V2 and V3 against the simulations' copy of the premises, given as
// premiseCopies; the reference always comes from the offer and curve tables.
export class SimulationResultOracle {
  constructor(
    private readonly simulations: SimulationRepository,
    private readonly offers: OfferRepository,
    private readonly curves: CurveRepository,
    private readonly calculation: SimulationCalculationService,
    private readonly premiseCopies: PrismaService | null,
  ) {}

  async judge(
    simulationIds: readonly string[],
    deadLetteredAggregateIds: ReadonlySet<string>,
    at: UtcInstant,
  ): Promise<SimulationJudgement[]> {
    const offers = new Map<string, Promise<Offer | null>>();
    const curves = new Map<string, Promise<Curve | null>>();
    const found: Simulation[] = [];
    for (const simulationId of simulationIds) {
      const simulation = this.foundOrNull(
        await this.simulations.findById(simulationId),
      );
      // A deleted simulation has nothing to judge.
      if (simulation) found.push(simulation);
    }
    const copies = this.premiseCopies
      ? await PremiseCopyRevisions.load(
          this.premiseCopies.client,
          found.map((simulation) => ({
            revision: simulation.revision,
            offerId: simulation.offerId,
            curveId: simulation.investment.curveId,
          })),
        )
      : null;
    const judgements: SimulationJudgement[] = [];
    for (const simulation of found) {
      const premises = await this.premisesOf(simulation, offers, curves);
      const currentInputFingerprint = copies
        ? copies.currentInputFingerprintOf({
            revision: simulation.revision,
            offerId: simulation.offerId,
            curveId: simulation.investment.curveId,
          })
        : SimulationCalculationService.inputFingerprintOf(simulation, premises);
      judgements.push(
        this.judgement(
          simulation,
          premises,
          currentInputFingerprint,
          deadLetteredAggregateIds,
          at,
        ),
      );
    }
    return judgements;
  }

  private judgement(
    simulation: Simulation,
    premises: SimulationCalculationPremises | null,
    currentInputFingerprint: InputFingerprint,
    deadLetteredAggregateIds: ReadonlySet<string>,
    at: UtcInstant,
  ): SimulationJudgement {
    const reference = premises
      ? this.calculation.calculate(
          simulation,
          premises.offer,
          premises.curve,
          at,
        )
      : null;
    const divergentFields = this.divergentFields(simulation, reference);
    const resultInputFingerprint = simulation.result?.inputFingerprint ?? null;
    const { isSettled } = SimulationResultValidity.create({
      calculationStatus: simulation.calculation.status,
      currentInputFingerprint,
      resultInputFingerprint,
    });
    const isDeadLettered = [
      simulation.id,
      simulation.offerId,
      simulation.investment.curveId,
    ].some((id) => id !== null && deadLetteredAggregateIds.has(id));

    return {
      simulationId: simulation.id,
      verdict: this.verdictOf(
        divergentFields,
        isSettled,
        isDeadLettered ||
          simulation.calculation.status === ESimulationCalculationStatus.FAILED,
      ),
      status: simulation.calculation.status,
      isSettled,
      isDeadLettered,
      referenceKind: reference?.kind ?? 'INVALID',
      divergentFields,
      resultInputFingerprint: resultInputFingerprint?.toString() ?? null,
      currentInputFingerprint: currentInputFingerprint.toString(),
    };
  }

  // A null reference (an offer or curve gone) or an INVALID one is matched by
  // the INVALID status; a CALCULATED one by a stored result equal in every
  // compared field, whatever the status.
  private divergentFields(
    simulation: Simulation,
    reference: SimulationCalculationOutcome | null,
  ): string[] {
    if (!reference || reference.kind === 'INVALID') {
      return simulation.calculation.status ===
        ESimulationCalculationStatus.INVALID
        ? []
        : ['status'];
    }
    const stored = simulation.result?.projection;
    if (!stored) return ['result'];
    const expected = reference.result.projection;
    return comparedFields
      .filter(
        ({ of }) =>
          !of(expected)
            .toDecimalPlaces(STORED_DECIMAL_PLACES)
            .equals(of(stored)),
      )
      .map(({ name }) => name);
  }

  private verdictOf(
    divergentFields: readonly string[],
    isSettled: boolean,
    isAlarmed: boolean,
  ): ESimulationVerdict {
    if (divergentFields.length === 0) return ESimulationVerdict.CORRECT;
    if (isAlarmed) return ESimulationVerdict.WRONG_ALARMED;
    if (!isSettled) return ESimulationVerdict.WRONG_VISIBLE;
    return ESimulationVerdict.WRONG_SILENT;
  }

  // Null when the offer or curve is gone, which makes the calculation
  // INVALID.
  private async premisesOf(
    simulation: Simulation,
    offers: Map<string, Promise<Offer | null>>,
    curves: Map<string, Promise<Curve | null>>,
  ): Promise<SimulationCalculationPremises | null> {
    const offer = await this.cached(offers, simulation.offerId, (id) =>
      this.offers.findById(id),
    );
    if (!offer) return null;
    const { curveId } = simulation.investment;
    if (!curveId) return { offer, curve: null };
    const curve = await this.cached(curves, curveId, (id) =>
      this.curves.findById(id),
    );
    return curve ? { offer, curve } : null;
  }

  private cached<T>(
    cache: Map<string, Promise<T | null>>,
    id: string,
    find: (id: string) => Promise<Result<T, AppError>>,
  ): Promise<T | null> {
    let entry = cache.get(id);
    if (!entry) {
      entry = find(id).then((found) => this.foundOrNull(found));
      cache.set(id, entry);
    }
    return entry;
  }

  // A failure to read would judge the simulation on premises it does not
  // have, so only a missing record is null.
  private foundOrNull<T>(found: Result<T, AppError>): T | null {
    if (found.isOk()) return found.value;
    if (found.error.kind === 'not-found') return null;
    throw found.error;
  }
}
