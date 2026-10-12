import {
  CalendarDate,
  UtcInstant,
  ValueObject,
} from '@investflow/shared-domain';
import { InvestmentCalculation } from '../calculations/investment-calculation.type';
import { TITLE_TYPE_RULES } from '../offers/title-type-rules';
import { ETitleType } from '../offers/title-type.enum';

// The revisions and methodology a result was calculated from. Plain values so
// read sides can compare them without loading the aggregates.
export interface SimulationResultInputs {
  readonly simulationRevision: number;
  readonly offerRevision: number;
  readonly curveRevision: number | null;
  readonly methodologyVersion: string;
}

export interface SimulationResultProps {
  readonly inputs: SimulationResultInputs;
  // The period calculated, which later edits may have changed.
  readonly investmentDate: CalendarDate;
  readonly maturityDate: CalendarDate;
  readonly calculation: InvestmentCalculation;
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
    offerRevision: number,
    curveRevision: number | null,
  ): SimulationResultInputs {
    return {
      simulationRevision,
      offerRevision,
      curveRevision,
      methodologyVersion: TITLE_TYPE_RULES[titleType].methodologyVersion,
    };
  }

  static isCurrent(
    recorded: SimulationResultInputs,
    target: SimulationResultInputs,
  ): boolean {
    return (
      recorded.simulationRevision === target.simulationRevision &&
      recorded.offerRevision === target.offerRevision &&
      recorded.curveRevision === target.curveRevision &&
      recorded.methodologyVersion === target.methodologyVersion
    );
  }

  get inputs(): SimulationResultInputs {
    return this.props.inputs;
  }

  get investmentDate(): CalendarDate {
    return this.props.investmentDate;
  }

  get maturityDate(): CalendarDate {
    return this.props.maturityDate;
  }

  get calculation(): InvestmentCalculation {
    return this.props.calculation;
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
