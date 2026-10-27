import {
  AggregateRoot,
  generateUuid,
  Result,
  Revision,
  UtcInstant,
} from '@investflow/shared-domain';
import {
  InvalidInvestmentPlanError,
  InvestmentPlanRevisionConflictError,
  InvestmentPlanSimulationLimitError,
} from './investment-plan.error';

export interface InvestmentPlanDetails {
  readonly name: string;
  readonly description: string | null;
}

// Changed only by behavior methods; readonly fields never change.
interface InvestmentPlanProps {
  readonly ownerId: string;
  name: string;
  description: string | null;
  // Simulations the owner would invest in together; deleted ones are never
  // loaded, so they leave the plan without a write.
  simulationIds: Set<string>;
  deletedAt: UtcInstant | null;
}

export type CreateInvestmentPlanProps = {
  readonly ownerId: string;
  readonly name: string;
  readonly description?: string | null;
};

export type ReconstituteInvestmentPlanProps = Omit<
  InvestmentPlanProps,
  'simulationIds'
> & {
  readonly id: string;
  readonly revision: number;
  readonly simulationIds: Iterable<string>;
};

export type InvestmentPlanEdit = Partial<InvestmentPlanDetails>;

export class InvestmentPlan extends AggregateRoot {
  static readonly SIMULATION_LIMIT = 50;

  private constructor(
    id: string,
    private readonly props: InvestmentPlanProps,
    revision: Revision,
  ) {
    super(id, revision);
  }

  static create(
    props: CreateInvestmentPlanProps,
  ): Result<InvestmentPlan, InvalidInvestmentPlanError> {
    const details = InvestmentPlan.normalize({
      name: props.name,
      description: props.description ?? null,
    });
    const invalid = InvestmentPlan.validate(details);
    if (invalid) return Result.err(invalid);

    return Result.ok(
      new InvestmentPlan(
        generateUuid(),
        {
          ...details,
          ownerId: props.ownerId,
          simulationIds: new Set(),
          deletedAt: null,
        },
        Revision.initial(),
      ),
    );
  }

  static reconstitute(props: ReconstituteInvestmentPlanProps): InvestmentPlan {
    const { id, revision, simulationIds, ...state } = props;
    return new InvestmentPlan(
      id,
      { ...state, simulationIds: new Set(simulationIds) },
      Revision.restore(revision),
    );
  }

  get ownerId(): string {
    return this.props.ownerId;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | null {
    return this.props.description;
  }

  get simulationIds(): readonly string[] {
    return [...this.props.simulationIds];
  }

  get deletedAt(): UtcInstant | null {
    return this.props.deletedAt;
  }

  assertRevision(
    expected: number,
  ): Result<this, InvestmentPlanRevisionConflictError> {
    return expected === this.revision
      ? Result.ok(this)
      : Result.err(new InvestmentPlanRevisionConflictError(this.id, expected));
  }

  editDetails(
    edit: InvestmentPlanEdit,
  ): Result<this, InvalidInvestmentPlanError> {
    const details = InvestmentPlan.normalize({
      name: edit.name ?? this.props.name,
      description:
        edit.description === undefined
          ? this.props.description
          : edit.description,
    });
    const invalid = InvestmentPlan.validate(details);
    if (invalid) return Result.err(invalid);
    if (
      details.name === this.props.name &&
      details.description === this.props.description
    ) {
      return Result.ok(this);
    }

    this.props.name = details.name;
    this.props.description = details.description;
    this.revisionTracker.increment();
    return Result.ok(this);
  }

  // Ids already in the plan are ignored, so repeating an add changes nothing.
  addSimulations(
    ids: readonly string[],
  ): Result<this, InvestmentPlanSimulationLimitError> {
    const added = new Set(
      ids.filter((id) => !this.props.simulationIds.has(id)),
    );
    if (added.size === 0) return Result.ok(this);
    const availableSlots =
      InvestmentPlan.SIMULATION_LIMIT - this.props.simulationIds.size;
    if (added.size > availableSlots) {
      return Result.err(
        new InvestmentPlanSimulationLimitError(
          this.id,
          InvestmentPlan.SIMULATION_LIMIT,
          Math.max(0, availableSlots),
        ),
      );
    }

    for (const id of added) this.props.simulationIds.add(id);
    this.revisionTracker.increment();
    return Result.ok(this);
  }

  removeSimulation(id: string): this {
    if (!this.props.simulationIds.delete(id)) return this;
    this.revisionTracker.increment();
    return this;
  }

  delete(at: UtcInstant): this {
    if (this.props.deletedAt) return this;
    this.props.deletedAt = at;
    this.revisionTracker.increment();
    return this;
  }

  private static normalize(
    details: InvestmentPlanDetails,
  ): InvestmentPlanDetails {
    return {
      name: details.name.trim(),
      description: details.description?.trim() || null,
    };
  }

  private static validate({
    name,
  }: InvestmentPlanDetails): InvalidInvestmentPlanError | null {
    return name.length
      ? null
      : new InvalidInvestmentPlanError('Informe o nome do plano.');
  }
}
