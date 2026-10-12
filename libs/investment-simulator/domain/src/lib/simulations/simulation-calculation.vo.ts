import {
  AppError,
  AppErrorMetadata,
  EAppErrorCode,
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
  OFFER_CHANGED = 'OFFER_CHANGED',
  OFFER_DELETED = 'OFFER_DELETED',
  CURVE_CHANGED = 'CURVE_CHANGED',
  CURVE_DELETED = 'CURVE_DELETED',
  METHODOLOGY_CHANGED = 'METHODOLOGY_CHANGED',
  RETRY_REQUESTED = 'RETRY_REQUESTED',
}

export interface SimulationCalculationCause {
  readonly kind: ESimulationCalculationCauseKind;
  // The offer or curve whose change queued the calculation.
  readonly refId: string | null;
  // Null for system processes.
  readonly actorId: string | null;
}

// Revisions are null when the premise could not be read.
export interface SimulationCalculationInputs {
  readonly simulationRevision: number;
  readonly offerRevision: number | null;
  readonly curveRevision: number | null;
}

export interface SimulationCalculationReason {
  readonly code: EAppErrorCode;
  readonly metadata: AppErrorMetadata;
}

export type SimulationCalculationOutcome =
  | { readonly kind: 'CALCULATED'; readonly result: SimulationResult }
  | {
      readonly kind: 'INVALID';
      readonly inputs: SimulationCalculationInputs;
      readonly reason: AppError;
    };

export interface SimulationCalculationProps {
  readonly status: ESimulationCalculationStatus;
  readonly changedAt: UtcInstant;
  readonly cause: SimulationCalculationCause;
  readonly inputs: SimulationCalculationInputs;
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
      inputs: { simulationRevision, offerRevision: null, curveRevision: null },
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

  get inputs(): SimulationCalculationInputs {
    return this.props.inputs;
  }

  get reason(): SimulationCalculationReason | null {
    return this.props.reason;
  }

  get isPending(): boolean {
    return this.props.status === ESimulationCalculationStatus.PENDING;
  }

  recorded(
    outcome: SimulationCalculationOutcome,
    at: UtcInstant,
  ): SimulationCalculation {
    if (outcome.kind === 'CALCULATED') {
      const { simulationRevision, offerRevision, curveRevision } =
        outcome.result.inputs;
      return new SimulationCalculation({
        ...this.props,
        status: ESimulationCalculationStatus.CALCULATED,
        changedAt: at,
        inputs: { simulationRevision, offerRevision, curveRevision },
        reason: null,
      });
    }
    return new SimulationCalculation({
      ...this.props,
      status: ESimulationCalculationStatus.INVALID,
      changedAt: at,
      inputs: outcome.inputs,
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
      reason: null,
    });
  }

  equals(other: SimulationCalculation): boolean {
    return (
      this.status === other.status &&
      this.changedAt.equals(other.changedAt) &&
      this.inputs.simulationRevision === other.inputs.simulationRevision
    );
  }
}
