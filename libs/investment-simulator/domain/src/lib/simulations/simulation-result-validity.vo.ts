import { InputFingerprint, ValueObject } from '@investflow/shared-domain';
import { ESimulationCalculationStatus } from './simulation-calculation.vo';

export interface SimulationResultValidityProps {
  readonly calculationStatus: ESimulationCalculationStatus;
  // Of the premises the simulation is at now.
  readonly currentInputFingerprint: InputFingerprint;
  // Of the last successful result; null until the first one.
  readonly resultInputFingerprint: InputFingerprint | null;
}

// Whether a simulation's last result still holds for its current premises.
export class SimulationResultValidity extends ValueObject<SimulationResultValidity> {
  private constructor(private readonly props: SimulationResultValidityProps) {
    super();
  }

  static create(
    props: SimulationResultValidityProps,
  ): SimulationResultValidity {
    return new SimulationResultValidity({ ...props });
  }

  get calculationStatus(): ESimulationCalculationStatus {
    return this.props.calculationStatus;
  }

  // False without a result.
  get isResultCurrent(): boolean {
    return (
      this.props.resultInputFingerprint?.equals(
        this.props.currentInputFingerprint,
      ) ?? false
    );
  }

  // Its result is final: calculated from the current premises with nothing
  // queued. A retry can queue a calculation for a result that is current.
  get isSettled(): boolean {
    return (
      this.props.calculationStatus ===
        ESimulationCalculationStatus.CALCULATED && this.isResultCurrent
    );
  }

  equals(other: SimulationResultValidity): boolean {
    const result = this.props.resultInputFingerprint;
    const otherResult = other.props.resultInputFingerprint;
    return (
      this.props.calculationStatus === other.props.calculationStatus &&
      this.props.currentInputFingerprint.equals(
        other.props.currentInputFingerprint,
      ) &&
      (result === null || otherResult === null
        ? result === otherResult
        : result.equals(otherResult))
    );
  }
}
