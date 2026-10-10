import {
  AggregateRoot,
  generateUuid,
  UtcInstant,
} from '@investflow/shared-domain';

interface SimulationProps {
  readonly ownerId: string;
  // The catalog offer the first inputs were filled from; null for typed terms.
  readonly sourceOfferId: string | null;
  deletedAt: UtcInstant | null;
}

export interface CreateSimulationProps {
  readonly ownerId: string;
  readonly sourceOfferId: string | null;
}

export type ReconstituteSimulationProps = SimulationProps & {
  readonly id: string;
};

// A simulation's inputs and results live in its calculations; the latest one
// is its current state.
export class Simulation extends AggregateRoot {
  private constructor(
    id: string,
    private readonly props: SimulationProps,
  ) {
    super(id);
  }

  static create(props: CreateSimulationProps): Simulation {
    return new Simulation(generateUuid(), {
      ownerId: props.ownerId,
      sourceOfferId: props.sourceOfferId,
      deletedAt: null,
    });
  }

  static reconstitute(props: ReconstituteSimulationProps): Simulation {
    return new Simulation(props.id, {
      ownerId: props.ownerId,
      sourceOfferId: props.sourceOfferId,
      deletedAt: props.deletedAt,
    });
  }

  get ownerId(): string {
    return this.props.ownerId;
  }

  get sourceOfferId(): string | null {
    return this.props.sourceOfferId;
  }

  get deletedAt(): UtcInstant | null {
    return this.props.deletedAt;
  }

  delete(at: UtcInstant): this {
    if (!this.props.deletedAt) this.props.deletedAt = at;
    return this;
  }
}
