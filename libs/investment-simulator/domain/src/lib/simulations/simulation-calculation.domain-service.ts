import {
  DomainError,
  EAppErrorCode,
  InputFingerprint,
  Result,
  UtcInstant,
} from '@investflow/shared-domain';
import { InvestmentCalculationError } from '../calculations/investment-calculation.error';
import type { InvestmentCalculator } from '../calculations/investment-calculator.domain-service';
import { InvestmentScenario } from '../calculations/investment-scenario.vo';
import type { Curve } from '../curves/curve.aggregate';
import type { Offer } from '../offers/offer.aggregate';
import type { InvestmentInputs } from './investment-inputs.vo';
import type { SimulationCalculationOutcome } from './simulation-calculation.vo';
import { SimulationResult } from './simulation-result.vo';
import type { Simulation } from './simulation.aggregate';

export class SimulationCalculationService {
  constructor(private readonly calculator: InvestmentCalculator) {}

  // Every rule a request can reject before saving; curve coverage needs the
  // whole calculation and is found only by calculate().
  validate(
    investment: InvestmentInputs,
    offer: Offer,
    curve: Curve | null,
  ): Result<InvestmentScenario, InvestmentCalculationError> {
    const scenario = InvestmentScenario.create({
      principal: investment.principal,
      investmentDate: investment.investmentDate,
      maturityDate: offer.maturityDate,
      titleType: offer.titleType,
      remuneration: offer.remunerationTerms,
      curve,
    });
    if (scenario.isErr()) return scenario;
    const checked = this.calculator.check(scenario.value);
    if (checked.isErr()) return checked;
    return scenario;
  }

  // Whether the recorded outcome already applies to the current premises, so
  // calculating again would change nothing.
  isCurrent(
    simulation: Simulation,
    offer: Offer,
    curve: Curve | null,
  ): boolean {
    return simulation.calculation.appliesTo(
      SimulationCalculationService.inputFingerprintOf(simulation, offer, curve),
    );
  }

  // A broken business rule is an INVALID outcome; a technical failure throws
  // so the calculation is retried.
  calculate(
    simulation: Simulation,
    offer: Offer,
    curve: Curve | null,
    at: UtcInstant,
  ): SimulationCalculationOutcome {
    const { investment } = simulation;
    if ((curve?.id ?? null) !== investment.curveId) {
      throw new DomainError('A curva não corresponde ao investimento.', {
        code: EAppErrorCode.INVESTMENT_SCENARIO_INVARIANT,
        kind: 'unexpected',
        metadata: {
          expectedCurveId: investment.curveId,
          actualCurveId: curve?.id ?? null,
        },
      });
    }
    const simulationRevision = simulation.revision;
    const inputFingerprint = SimulationCalculationService.inputFingerprintOf(
      simulation,
      offer,
      curve,
    );

    const scenario = this.validate(investment, offer, curve);
    if (scenario.isErr()) {
      return {
        kind: 'INVALID',
        simulationRevision,
        inputFingerprint,
        reason: scenario.error,
      };
    }
    const projection = this.calculator.calculate(scenario.value);
    if (projection.isErr()) {
      if (projection.error.kind === 'unexpected') throw projection.error;
      return {
        kind: 'INVALID',
        simulationRevision,
        inputFingerprint,
        reason: projection.error,
      };
    }
    return {
      kind: 'CALCULATED',
      simulationRevision,
      result: SimulationResult.create({
        inputFingerprint,
        projection: projection.value,
        calculatedAt: at,
      }),
    };
  }

  private static inputFingerprintOf(
    simulation: Simulation,
    offer: Offer,
    curve: Curve | null,
  ): InputFingerprint {
    return SimulationResult.inputFingerprintFor({
      simulationRevision: simulation.revision,
      offer,
      curveValuesRevision: curve?.valuesRevision ?? null,
    });
  }
}
