import {
  AggregateRoot,
  generateUuid,
  UtcInstant,
} from '@investflow/shared-domain';
import { InvestmentCalculation } from '../calculations/investment-calculation.type';
import { METHODOLOGY_VERSION } from '../calculations/investment-calculator.domain-service';
import { InvestmentInputs } from './investment-inputs.vo';

interface SimulationCalculationProps {
  readonly simulationId: string;
  readonly investment: InvestmentInputs;
  readonly result: InvestmentCalculation;
  readonly calculatedAt: UtcInstant;
}

export type RecordSimulationCalculationProps = SimulationCalculationProps;

export type ReconstituteSimulationCalculationProps =
  SimulationCalculationProps & { readonly id: string };

// Immutable and append-only. The simulation's fixed terms, this investment and
// immutable curves reproduce the result under the recorded methodology.
// Recorded through Simulation, which enforces its own rules first.
export class SimulationCalculation extends AggregateRoot {
  private constructor(
    id: string,
    private readonly props: SimulationCalculationProps,
  ) {
    super(id);
  }

  static record(props: RecordSimulationCalculationProps): SimulationCalculation {
    return new SimulationCalculation(generateUuid(), { ...props });
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

  get investment(): InvestmentInputs {
    return this.props.investment;
  }

  get result(): InvestmentCalculation {
    return this.props.result;
  }

  get calculatedAt(): UtcInstant {
    return this.props.calculatedAt;
  }
}
