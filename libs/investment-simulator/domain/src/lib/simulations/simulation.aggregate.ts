import {
  AggregateRoot,
  generateUuid,
  Result,
  Revision,
  UtcInstant,
} from '@investflow/shared-domain';
import { InvestmentInputs } from './investment-inputs.vo';
import {
  SimulationCalculation,
  SimulationCalculationCause,
  SimulationCalculationOutcome,
} from './simulation-calculation.vo';
import { SimulationResult } from './simulation-result.vo';
import {
  SimulationCalculationStaleError,
  SimulationDeletedError,
  SimulationRevisionConflictError,
} from './simulation.error';
import {
  SimulationCalculationRequested,
  SimulationCreated,
  SimulationEdited,
} from './simulation.events';

// Changed only by behavior methods; readonly fields never change.
interface SimulationProps {
  readonly ownerId: string;
  offerId: string;
  investment: InvestmentInputs;
  calculation: SimulationCalculation;
  // The last successful calculation; null until the first one.
  result: SimulationResult | null;
  deletedAt: UtcInstant | null;
}

export interface SimulationPremisesProps {
  readonly offerId: string;
  readonly investment: InvestmentInputs;
}

export interface CreateSimulationProps extends SimulationPremisesProps {
  readonly ownerId: string;
}

export type ReconstituteSimulationProps = SimulationProps & {
  readonly id: string;
  readonly revision: number;
};

export class Simulation extends AggregateRoot {
  private constructor(
    id: string,
    private readonly props: SimulationProps,
    revision: Revision,
  ) {
    super(id, revision);
  }

  static create(
    props: CreateSimulationProps,
    cause: SimulationCalculationCause,
    at: UtcInstant,
  ): Simulation {
    const simulation = new Simulation(
      generateUuid(),
      {
        ownerId: props.ownerId,
        offerId: props.offerId,
        investment: props.investment,
        calculation: SimulationCalculation.pending(cause, 1, at),
        result: null,
        deletedAt: null,
      },
      Revision.initial(),
    );
    return simulation.apply(new SimulationCreated(simulation.id, at));
  }

  static reconstitute(props: ReconstituteSimulationProps): Simulation {
    const { id, revision, ...state } = props;
    return new Simulation(id, state, Revision.restore(revision));
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

  get calculation(): SimulationCalculation {
    return this.props.calculation;
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
    return expected === this.revision
      ? Result.ok(this)
      : Result.err(new SimulationRevisionConflictError(this.id, expected));
  }

  // Queues a calculation even when nothing changed, so saving again picks up
  // edits to the offer and curve.
  edit(
    props: SimulationPremisesProps,
    cause: SimulationCalculationCause,
    at: UtcInstant,
  ): Result<this, SimulationDeletedError> {
    if (this.props.deletedAt) {
      return Result.err(new SimulationDeletedError(this.id));
    }
    const unchanged =
      props.offerId === this.props.offerId &&
      props.investment.equals(this.props.investment);
    this.props.offerId = props.offerId;
    this.props.investment = props.investment;
    if (!unchanged) this.revisionTracker.increment();
    this.queueCalculation(cause, at);
    return Result.ok(this.apply(new SimulationEdited(this.id, at)));
  }

  requestCalculation(
    cause: SimulationCalculationCause,
    at: UtcInstant,
  ): Result<this, SimulationDeletedError> {
    if (this.props.deletedAt) {
      return Result.err(new SimulationDeletedError(this.id));
    }
    this.queueCalculation(cause, at);
    return Result.ok(
      this.apply(new SimulationCalculationRequested(this.id, at)),
    );
  }

  // An INVALID outcome keeps the last successful result.
  recordCalculation(
    outcome: SimulationCalculationOutcome,
    at: UtcInstant,
  ): Result<this, SimulationCalculationStaleError> {
    const simulationRevision =
      outcome.kind === 'CALCULATED'
        ? outcome.result.inputs.simulationRevision
        : outcome.inputs.simulationRevision;
    if (this.props.deletedAt || simulationRevision !== this.revision) {
      return Result.err(
        new SimulationCalculationStaleError(this.id, simulationRevision),
      );
    }
    this.props.calculation = this.props.calculation.recorded(outcome, at);
    if (outcome.kind === 'CALCULATED') this.props.result = outcome.result;
    return Result.ok(this);
  }

  // Only a calculation still waiting can fail; a newer outcome stands.
  markCalculationFailed(at: UtcInstant): this {
    if (!this.props.calculation.isPending) return this;
    this.props.calculation = this.props.calculation.failed(at);
    return this;
  }

  delete(at: UtcInstant): this {
    if (this.props.deletedAt) return this;
    this.props.deletedAt = at;
    this.revisionTracker.increment();
    return this;
  }

  // Each caller raises the event saying why, which the calculation consumer
  // also handles.
  private queueCalculation(
    cause: SimulationCalculationCause,
    at: UtcInstant,
  ): void {
    this.props.calculation = SimulationCalculation.pending(
      cause,
      this.revision,
      at,
    );
  }
}
