import {
  InputFingerprint,
  UtcInstant,
  ValueObject,
} from '@investflow/shared-domain';
import { InvestmentProjection } from '../calculations/investment-projection.vo';
import { TITLE_TYPE_RULES } from '../offers/title-type-rules';
import { ETitleType } from '../offers/title-type.enum';

// The versions a simulation's calculation depends on, as read sides hold them
// without loading the aggregates.
export interface SimulationPremiseVersions {
  readonly simulationRevision: number;
  // Null when the offer could not be read.
  readonly offer: {
    readonly titleType: ETitleType;
    readonly termsRevision: number;
  } | null;
  readonly curveValuesRevision: number | null;
}

export interface SimulationResultProps {
  readonly inputFingerprint: InputFingerprint;
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

  // The only place that says what a simulation's calculation depends on.
  static inputFingerprintFor(
    premises: SimulationPremiseVersions,
  ): InputFingerprint {
    const { simulationRevision, offer, curveValuesRevision } = premises;
    return InputFingerprint.of(1, {
      simulation: simulationRevision,
      offerTerms: offer?.termsRevision ?? null,
      curveValues: curveValuesRevision,
      methodology: offer
        ? TITLE_TYPE_RULES[offer.titleType].methodologyVersion
        : null,
    });
  }

  get inputFingerprint(): InputFingerprint {
    return this.props.inputFingerprint;
  }

  get projection(): InvestmentProjection {
    return this.props.projection;
  }

  get calculatedAt(): UtcInstant {
    return this.props.calculatedAt;
  }

  equals(other: SimulationResult): boolean {
    return (
      this.inputFingerprint.equals(other.inputFingerprint) &&
      this.calculatedAt.equals(other.calculatedAt)
    );
  }
}
