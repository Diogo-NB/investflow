import {
  AggregateRoot,
  DomainError,
  EAppErrorCode,
  generateUuid,
  Result,
  UtcInstant,
} from '@investflow/shared-domain';
import { InvestmentCalculationError } from '../calculations/investment-calculation.error';
import type { InvestmentCalculator } from '../calculations/investment-calculator.domain-service';
import { InvestmentScenario } from '../calculations/investment-scenario.vo';
import type { IndexCurve } from '../index-curves/index-curve.aggregate';
import { InvestmentTerms } from '../offers/terms/investment-terms.vo';
import { InvestmentInputs } from './investment-inputs.vo';
import { SimulationCalculation } from './simulation-calculation.aggregate';
import { SimulationDeletedError } from './simulation.error';

interface SimulationProps {
  readonly ownerId: string;
  // The catalog offer the terms were filled from; null for typed terms.
  readonly sourceOfferId: string | null;
  // Fixed for the simulation's life: other terms make another simulation.
  readonly terms: InvestmentTerms;
  deletedAt: UtcInstant | null;
}

export interface CalculateSimulationProps {
  readonly investment: InvestmentInputs;
  // The curve the investment references; null for fixed rates.
  readonly indexCurve: IndexCurve | null;
  readonly calculator: InvestmentCalculator;
  readonly calculatedAt: UtcInstant;
}

export interface StartSimulationProps extends CalculateSimulationProps {
  readonly ownerId: string;
  readonly sourceOfferId: string | null;
  readonly terms: InvestmentTerms;
}

export interface StartedSimulation {
  readonly simulation: Simulation;
  readonly calculation: SimulationCalculation;
}

export type ReconstituteSimulationProps = SimulationProps & {
  readonly id: string;
};

// The CDB being simulated. Its calculations hold each investment and result;
// the latest one is its current state.
export class Simulation extends AggregateRoot {
  private constructor(
    id: string,
    private readonly props: SimulationProps,
  ) {
    super(id);
  }

  // A simulation exists only together with its first successful calculation.
  static start(
    props: StartSimulationProps,
  ): Result<StartedSimulation, InvestmentCalculationError> {
    const simulation = new Simulation(generateUuid(), {
      ownerId: props.ownerId,
      sourceOfferId: props.sourceOfferId,
      terms: props.terms,
      deletedAt: null,
    });
    const calculation = simulation.calculateUnchecked(props);
    if (calculation.isErr()) return calculation;
    return Result.ok({ simulation, calculation: calculation.value });
  }

  static reconstitute(props: ReconstituteSimulationProps): Simulation {
    return new Simulation(props.id, {
      ownerId: props.ownerId,
      sourceOfferId: props.sourceOfferId,
      terms: props.terms,
      deletedAt: props.deletedAt,
    });
  }

  get ownerId(): string {
    return this.props.ownerId;
  }

  get sourceOfferId(): string | null {
    return this.props.sourceOfferId;
  }

  get terms(): InvestmentTerms {
    return this.props.terms;
  }

  get deletedAt(): UtcInstant | null {
    return this.props.deletedAt;
  }

  calculate(
    props: CalculateSimulationProps,
  ): Result<
    SimulationCalculation,
    SimulationDeletedError | InvestmentCalculationError
  > {
    if (this.props.deletedAt) {
      return Result.err(new SimulationDeletedError(this.id));
    }
    return this.calculateUnchecked(props);
  }

  delete(at: UtcInstant): this {
    if (!this.props.deletedAt) this.props.deletedAt = at;
    return this;
  }

  private calculateUnchecked({
    investment,
    indexCurve,
    calculator,
    calculatedAt,
  }: CalculateSimulationProps): Result<
    SimulationCalculation,
    InvestmentCalculationError
  > {
    const scenario = this.scenarioFor(investment, indexCurve);
    if (scenario.isErr()) return scenario;
    const result = calculator.calculate(scenario.value);
    if (result.isErr()) return result;
    return Result.ok(
      SimulationCalculation.record({
        simulationId: this.id,
        investment,
        result: result.value,
        calculatedAt,
      }),
    );
  }

  private scenarioFor(
    investment: InvestmentInputs,
    indexCurve: IndexCurve | null,
  ): Result<InvestmentScenario, InvestmentCalculationError> {
    if ((indexCurve?.id ?? null) !== investment.indexCurveId) {
      throw new DomainError('A curva não corresponde ao investimento.', {
        code: EAppErrorCode.INVESTMENT_SCENARIO_INVARIANT,
        kind: 'unexpected',
        metadata: {
          expectedCurveId: investment.indexCurveId,
          actualCurveId: indexCurve?.id ?? null,
        },
      });
    }
    const { terms } = this.props;
    return InvestmentScenario.create({
      principal: investment.principal,
      investmentDate: investment.investmentDate,
      maturityDate: terms.maturityDate,
      titleType: terms.titleType,
      remuneration: terms.remuneration,
      indexCurve,
    });
  }
}
