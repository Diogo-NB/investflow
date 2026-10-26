import { UtcInstant, ValueObject } from '@investflow/shared-domain';
import { InvestmentProjection } from '../calculations/investment-projection.vo';
import { TITLE_TYPE_RULES } from '../offers/title-type-rules';
import { ETitleType } from '../offers/title-type.enum';

// The revisions and methodology a result was calculated from. Plain values so
// read sides can compare them without loading the aggregates.
export interface SimulationResultInputs {
  readonly simulationRevision: number;
  readonly offerTermsRevision: number;
  readonly curveValuesRevision: number | null;
  readonly methodologyVersion: string;
}

export interface SimulationResultProps {
  readonly inputs: SimulationResultInputs;
  // Its term is the period calculated, which later edits may have changed.
  readonly projection: InvestmentProjection;
  readonly calculatedAt: UtcInstant;
}

export class SimulationResult extends ValueObject<SimulationResult> {
  private constructor(private readonly props: SimulationResultProps) {
    super();
  }

  static create(props: SimulationResultProps): SimulationResult {
    return new SimulationResult({ ...props });
  }

  static targetFor(
    simulationRevision: number,
    titleType: ETitleType,
    offerTermsRevision: number,
    curveValuesRevision: number | null,
  ): SimulationResultInputs {
    return {
      simulationRevision,
      offerTermsRevision,
      curveValuesRevision,
      methodologyVersion: TITLE_TYPE_RULES[titleType].methodologyVersion,
    };
  }

  static isCurrent(
    recorded: SimulationResultInputs,
    target: SimulationResultInputs,
  ): boolean {
    return (
      recorded.simulationRevision === target.simulationRevision &&
      recorded.offerTermsRevision === target.offerTermsRevision &&
      recorded.curveValuesRevision === target.curveValuesRevision &&
      recorded.methodologyVersion === target.methodologyVersion
    );
  }

  get inputs(): SimulationResultInputs {
    return this.props.inputs;
  }

  get projection(): InvestmentProjection {
    return this.props.projection;
  }

  get calculatedAt(): UtcInstant {
    return this.props.calculatedAt;
  }

  equals(other: SimulationResult): boolean {
    return (
      SimulationResult.isCurrent(this.inputs, other.inputs) &&
      this.calculatedAt.equals(other.calculatedAt)
    );
  }
}
