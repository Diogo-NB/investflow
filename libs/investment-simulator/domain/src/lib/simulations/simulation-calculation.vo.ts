import {
  AppError,
  AppErrorMetadata,
  EAppErrorCode,
  InputFingerprint,
  UtcInstant,
  ValueObject,
} from '@investflow/shared-domain';
import { SimulationResult } from './simulation-result.vo';

export enum ESimulationCalculationStatus {
  PENDING = 'PENDING',
  CALCULATED = 'CALCULATED',
  INVALID = 'INVALID',
  FAILED = 'FAILED',
}

export enum ESimulationCalculationCauseKind {
  CREATED = 'CREATED',
  SIMULATION_EDITED = 'SIMULATION_EDITED',
  METHODOLOGY_CHANGED = 'METHODOLOGY_CHANGED',
  RETRY_REQUESTED = 'RETRY_REQUESTED',
}

export interface SimulationCalculationCause {
  readonly kind: ESimulationCalculationCauseKind;
  // Null for system processes.
  readonly actorId: string | null;
}

export interface SimulationCalculationReason {
  readonly code: EAppErrorCode;
  readonly metadata: AppErrorMetadata;
}

export type SimulationCalculationOutcome =
  | {
      readonly kind: 'CALCULATED';
      readonly simulationRevision: number;
      readonly result: SimulationResult;
    }
  | {
      readonly kind: 'INVALID';
      readonly simulationRevision: number;
      readonly inputFingerprint: InputFingerprint;
      readonly reason: AppError;
    };

export interface SimulationCalculationProps {
  readonly status: ESimulationCalculationStatus;
  readonly changedAt: UtcInstant;
  readonly cause: SimulationCalculationCause;
  // The simulation revision the status was written for; an outcome is saved
  // only while it is unchanged.
  readonly simulationRevision: number;
  // What the outcome was calculated from; null for PENDING and FAILED, which
  // recorded none.
  readonly inputFingerprint: InputFingerprint | null;
  // Only for INVALID.
  readonly reason: SimulationCalculationReason | null;
}

// The current calculation state of a simulation. The cause is set when the
// calculation is queued and kept on its outcome.
export class SimulationCalculation extends ValueObject<SimulationCalculation> {
  private constructor(private readonly props: SimulationCalculationProps) {
    super();
  }

  static pending(
    cause: SimulationCalculationCause,
    simulationRevision: number,
    at: UtcInstant,
  ): SimulationCalculation {
    return new SimulationCalculation({
      status: ESimulationCalculationStatus.PENDING,
      changedAt: at,
      cause,
      simulationRevision,
      inputFingerprint: null,
      reason: null,
    });
  }

  static reconstitute(
    props: SimulationCalculationProps,
  ): SimulationCalculation {
    return new SimulationCalculation({ ...props });
  }

  get status(): ESimulationCalculationStatus {
    return this.props.status;
  }

  get changedAt(): UtcInstant {
    return this.props.changedAt;
  }

  get cause(): SimulationCalculationCause {
    return this.props.cause;
  }

  get simulationRevision(): number {
    return this.props.simulationRevision;
  }

  get inputFingerprint(): InputFingerprint | null {
    return this.props.inputFingerprint;
  }

  get reason(): SimulationCalculationReason | null {
    return this.props.reason;
  }

  get isPending(): boolean {
    return this.props.status === ESimulationCalculationStatus.PENDING;
  }

  // Whether an outcome was recorded for the inputs with this fingerprint.
  appliesTo(current: InputFingerprint): boolean {
    return this.props.inputFingerprint?.equals(current) ?? false;
  }

  recorded(
    outcome: SimulationCalculationOutcome,
    at: UtcInstant,
  ): SimulationCalculation {
    if (outcome.kind === 'CALCULATED') {
      return new SimulationCalculation({
        ...this.props,
        status: ESimulationCalculationStatus.CALCULATED,
        changedAt: at,
        simulationRevision: outcome.simulationRevision,
        inputFingerprint: outcome.result.inputFingerprint,
        reason: null,
      });
    }
    return new SimulationCalculation({
      ...this.props,
      status: ESimulationCalculationStatus.INVALID,
      changedAt: at,
      simulationRevision: outcome.simulationRevision,
      inputFingerprint: outcome.inputFingerprint,
      reason: {
        code: outcome.reason.code,
        metadata: outcome.reason.metadata ?? {},
      },
    });
  }

  failed(at: UtcInstant): SimulationCalculation {
    return new SimulationCalculation({
      ...this.props,
      status: ESimulationCalculationStatus.FAILED,
      changedAt: at,
      inputFingerprint: null,
      reason: null,
    });
  }

  equals(other: SimulationCalculation): boolean {
    return (
      this.status === other.status &&
      this.changedAt.equals(other.changedAt) &&
      this.simulationRevision === other.simulationRevision
    );
  }
}
