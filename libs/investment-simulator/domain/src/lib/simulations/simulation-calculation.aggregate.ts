import {
  AggregateRoot,
  generateUuid,
  UtcInstant,
} from '@investflow/shared-domain';
import { InvestmentCalculation } from '../calculations/investment-calculation.type';
import { TITLE_TYPE_RULES } from '../offers/title-type-rules';
import { ETitleType } from '../offers/title-type.enum';
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

// Immutable and append-only.
// Recorded through Simulation, which enforces its own rules first.
export class SimulationCalculation extends AggregateRoot {
  private constructor(
    id: string,
    private readonly props: SimulationCalculationProps,
  ) {
    super(id);
  }

  static record(
    props: RecordSimulationCalculationProps,
  ): SimulationCalculation {
    return new SimulationCalculation(generateUuid(), { ...props });
  }

  // Takes plain values so read sides need not load the aggregates.
  static isOutdated(
    titleType: ETitleType,
    methodologyVersion: string,
  ): boolean {
    return (
      methodologyVersion !== TITLE_TYPE_RULES[titleType].methodologyVersion
    );
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
