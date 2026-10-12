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
import type { Curve } from '../curves/curve.aggregate';
import type { Offer } from '../offers/offer.aggregate';
import { InvestmentInputs } from './investment-inputs.vo';
import { SimulationResult } from './simulation-result.vo';
import {
  SimulationDeletedError,
  SimulationRevisionConflictError,
} from './simulation.error';

interface SimulationProps {
  readonly ownerId: string;
  readonly offerId: string;
  readonly investment: InvestmentInputs;
  readonly revision: number;
  // Null until the first successful calculation.
  readonly result: SimulationResult | null;
  readonly deletedAt: UtcInstant | null;
}

// The premises a calculation reads. The curve is the one the investment
// references; null for fixed rates.
export interface SimulationCalculationProps {
  readonly investment: InvestmentInputs;
  readonly offer: Offer;
  readonly curve: Curve | null;
  readonly calculator: InvestmentCalculator;
  readonly calculatedAt: UtcInstant;
}

export interface CreateSimulationProps extends SimulationCalculationProps {
  readonly ownerId: string;
}

export type ReconstituteSimulationProps = SimulationProps & {
  readonly id: string;
};

export class Simulation extends AggregateRoot {
  private constructor(
    id: string,
    private props: SimulationProps,
  ) {
    super(id);
  }

  // Saved only together with its first successful calculation.
  static create(
    props: CreateSimulationProps,
  ): Result<Simulation, InvestmentCalculationError> {
    const simulation = new Simulation(generateUuid(), {
      ownerId: props.ownerId,
      offerId: props.offer.id,
      investment: props.investment,
      revision: 1,
      result: null,
      deletedAt: null,
    });
    const result = simulation.calculateAt(1, props);
    if (result.isErr()) return result;
    simulation.props = { ...simulation.props, result: result.value };
    return Result.ok(simulation);
  }

  static reconstitute(props: ReconstituteSimulationProps): Simulation {
    const { id, ...state } = props;
    return new Simulation(id, state);
  }

  get ownerId(): string {
    return this.props.ownerId;
  }

  get offerId(): string {
    return this.props.offerId;
  }

  get investment(): InvestmentInputs {
    return this.props.investment;
  }

  get revision(): number {
    return this.props.revision;
  }

  get result(): SimulationResult | null {
    return this.props.result;
  }

  get deletedAt(): UtcInstant | null {
    return this.props.deletedAt;
  }

  assertRevision(
    expected: number,
  ): Result<this, SimulationRevisionConflictError> {
    return expected === this.props.revision
      ? Result.ok(this)
      : Result.err(new SimulationRevisionConflictError(this.id, expected));
  }

  // Recalculates even when nothing changed, so the result picks up edits to
  // the offer and curve. A rejected calculation changes nothing.
  edit(
    props: SimulationCalculationProps,
  ): Result<this, SimulationDeletedError | InvestmentCalculationError> {
    if (this.props.deletedAt) {
      return Result.err(new SimulationDeletedError(this.id));
    }
    const unchanged =
      props.offer.id === this.props.offerId &&
      props.investment.equals(this.props.investment);
    const revision = unchanged ? this.props.revision : this.props.revision + 1;

    const result = this.calculateAt(revision, props);
    if (result.isErr()) return result;

    this.props = {
      ...this.props,
      offerId: props.offer.id,
      investment: props.investment,
      revision,
      result: result.value,
    };
    return Result.ok(this);
  }

  delete(at: UtcInstant): this {
    if (this.props.deletedAt) return this;
    this.props = {
      ...this.props,
      deletedAt: at,
      revision: this.props.revision + 1,
    };
    return this;
  }

  private calculateAt(
    simulationRevision: number,
    {
      investment,
      offer,
      curve,
      calculator,
      calculatedAt,
    }: SimulationCalculationProps,
  ): Result<SimulationResult, InvestmentCalculationError> {
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
    const scenario = InvestmentScenario.create({
      principal: investment.principal,
      investmentDate: investment.investmentDate,
      maturityDate: offer.maturityDate,
      titleType: offer.titleType,
      remuneration: offer.remunerationTerms,
      curve,
    });
    if (scenario.isErr()) return scenario;
    const calculation = calculator.calculate(scenario.value);
    if (calculation.isErr()) return calculation;
    return Result.ok(
      SimulationResult.create({
        inputs: {
          simulationRevision,
          offerRevision: offer.revision,
          curveRevision: curve?.revision ?? null,
          methodologyVersion: calculation.value.methodologyVersion,
        },
        investmentDate: investment.investmentDate,
        maturityDate: offer.maturityDate,
        calculation: calculation.value,
        calculatedAt,
      }),
    );
  }
}
