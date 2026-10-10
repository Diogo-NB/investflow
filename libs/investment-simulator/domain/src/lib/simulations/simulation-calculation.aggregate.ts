import {
  AggregateRoot,
  generateUuid,
  Result,
  UtcInstant,
} from '@investflow/shared-domain';
import { InvestmentCalculation } from '../calculations/investment-calculation.type';
import { METHODOLOGY_VERSION } from '../calculations/investment-calculator.domain-service';
import type { Simulation } from './simulation.aggregate';
import { SimulationDeletedError } from './simulation.error';
import { SimulationInputs } from './simulation-inputs.vo';

interface SimulationCalculationProps {
  readonly simulationId: string;
  readonly inputs: SimulationInputs;
  readonly result: InvestmentCalculation;
  readonly calculatedAt: UtcInstant;
}

export interface RecordSimulationCalculationProps {
  readonly simulation: Simulation;
  readonly inputs: SimulationInputs;
  readonly result: InvestmentCalculation;
  readonly calculatedAt: UtcInstant;
}

export type ReconstituteSimulationCalculationProps =
  SimulationCalculationProps & { readonly id: string };

// Immutable and append-only. Index curves are immutable too, so the inputs
// fully reproduce the result under the recorded methodology.
export class SimulationCalculation extends AggregateRoot {
  private constructor(
    id: string,
    private readonly props: SimulationCalculationProps,
  ) {
    super(id);
  }

  static record(
    props: RecordSimulationCalculationProps,
  ): Result<SimulationCalculation, SimulationDeletedError> {
    if (props.simulation.deletedAt) {
      return Result.err(new SimulationDeletedError(props.simulation.id));
    }
    return Result.ok(
      new SimulationCalculation(generateUuid(), {
        simulationId: props.simulation.id,
        inputs: props.inputs,
        result: props.result,
        calculatedAt: props.calculatedAt,
      }),
    );
  }

  // Takes a plain value so read sides need not load the aggregate.
  static isOutdated(methodologyVersion: string): boolean {
    return methodologyVersion !== METHODOLOGY_VERSION;
  }

  static reconstitute(
    props: ReconstituteSimulationCalculationProps,
  ): SimulationCalculation {
    const { id, ...state } = props;
    return new SimulationCalculation(id, state);
  }

  get simulationId(): string {
    return this.props.simulationId;
  }

  get inputs(): SimulationInputs {
    return this.props.inputs;
  }

  get result(): InvestmentCalculation {
    return this.props.result;
  }

  get calculatedAt(): UtcInstant {
    return this.props.calculatedAt;
  }
}
