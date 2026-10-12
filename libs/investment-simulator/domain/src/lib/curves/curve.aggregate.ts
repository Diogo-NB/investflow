import {
  CalendarDate,
  AggregateRoot,
  generateUuid,
  Result,
  Revision,
  UtcInstant,
} from '@investflow/shared-domain';
import { CurveInterval } from './curve-interval.vo';
import {
  CurveCoverageError,
  CurveRevisionConflictError,
  CurveValueNotFoundError,
  InvalidCurveError,
} from './curve.error';
import { CurveChanged, CurveCreated, CurveDeleted } from './curve.events';
import { EEconomicIndex } from './economic-index.enum';
import { EIndexValueConvention } from './index-value-convention.enum';
import { IndexValue } from './index-value.vo';

export interface CurveContent {
  readonly name: string;
  readonly description: string | null;
  readonly intervals: readonly CurveInterval[];
}

// Changed only by behavior methods; readonly fields never change.
interface CurveProps {
  // Fixes the value convention.
  readonly index: EEconomicIndex;
  readonly ownerId: string | null;
  name: string;
  description: string | null;
  intervals: readonly CurveInterval[];
  deletedAt: UtcInstant | null;
}

export type CreateCurveProps = Pick<
  CurveProps,
  'index' | 'ownerId' | 'name' | 'intervals'
> & { readonly description?: string | null };

export type ReconstituteCurveProps = CurveProps & {
  readonly id: string;
  readonly revision: number;
};

export type CurveEdit = Partial<CurveContent>;

export class Curve extends AggregateRoot {
  private constructor(
    id: string,
    private readonly props: CurveProps,
    revision: Revision,
  ) {
    super(id, revision);
  }

  static create(
    props: CreateCurveProps,
    occurredAt: UtcInstant,
  ): Result<Curve, InvalidCurveError> {
    const content = Curve.normalize({
      name: props.name,
      description: props.description ?? null,
      intervals: props.intervals,
    });
    const invalid = Curve.validate(props.index, content);
    if (invalid) return Result.err(invalid);

    const curve = new Curve(
      generateUuid(),
      {
        ...content,
        index: props.index,
        ownerId: props.ownerId,
        deletedAt: null,
      },
      Revision.initial(),
    );
    return Result.ok(curve.apply(new CurveCreated(curve.id, occurredAt)));
  }

  static reconstitute(props: ReconstituteCurveProps): Curve {
    const { id, revision, ...state } = props;
    return new Curve(
      id,
      { ...state, intervals: sortIntervals(state.intervals) },
      Revision.restore(revision),
    );
  }

  get index(): EEconomicIndex {
    return this.props.index;
  }

  get convention(): EIndexValueConvention {
    return Curve.conventionOf(this.props.index);
  }

  get ownerId(): string | null {
    return this.props.ownerId;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | null {
    return this.props.description;
  }

  get intervals(): readonly CurveInterval[] {
    return [...this.props.intervals];
  }

  get deletedAt(): UtcInstant | null {
    return this.props.deletedAt;
  }

  isVisibleTo(actorId: string | null): boolean {
    return this.props.ownerId === null || this.props.ownerId === actorId;
  }

  canBeChangedBy(actorId: string | null): boolean {
    return this.props.ownerId === actorId;
  }

  assertRevision(expected: number): Result<this, CurveRevisionConflictError> {
    return expected === this.revision
      ? Result.ok(this)
      : Result.err(new CurveRevisionConflictError(this.id, expected));
  }

  // A private copy for the actor, including of a system curve.
  duplicateFor(
    ownerId: string | null,
    occurredAt: UtcInstant,
  ): Result<Curve, InvalidCurveError> {
    return Curve.create(
      {
        index: this.props.index,
        ownerId,
        name: `${this.props.name} (cópia)`,
        description: this.props.description,
        intervals: this.props.intervals,
      },
      occurredAt,
    );
  }

  edit(
    edit: CurveEdit,
    occurredAt: UtcInstant,
  ): Result<this, InvalidCurveError> {
    const content = Curve.normalize({
      name: edit.name ?? this.props.name,
      description:
        edit.description === undefined
          ? this.props.description
          : edit.description,
      intervals: edit.intervals ?? this.props.intervals,
    });
    const invalid = Curve.validate(this.props.index, content);
    if (invalid) return Result.err(invalid);

    if (this.isUnchanged(content)) return Result.ok(this);

    this.props.name = content.name;
    this.props.description = content.description;
    this.props.intervals = content.intervals;
    this.revisionTracker.increment();
    return Result.ok(this.apply(new CurveChanged(this.id, occurredAt)));
  }

  delete(at: UtcInstant): this {
    if (this.props.deletedAt) return this;
    this.props.deletedAt = at;
    this.revisionTracker.increment();
    return this.apply(new CurveDeleted(this.id, at));
  }

  valueAt(
    reference: CalendarDate,
  ): Result<IndexValue, CurveValueNotFoundError> {
    const interval = this.findInterval(reference);
    return interval === undefined
      ? Result.err(new CurveValueNotFoundError(this.id, reference))
      : Result.ok(interval.value);
  }

  // Resolves all references or reports every uncovered one, never a partial list.
  valuesAt(
    references: readonly CalendarDate[],
  ): Result<IndexValue[], CurveCoverageError> {
    const values: IndexValue[] = [];
    const missing: { start: CalendarDate; end: CalendarDate }[] = [];
    let previousMissing = false;

    for (const reference of references) {
      const interval = this.findInterval(reference);
      if (interval) {
        values.push(interval.value);
      } else if (previousMissing) {
        // Adjacent requested references that are both missing form one gap.
        missing[missing.length - 1].end = reference;
      } else {
        missing.push({ start: reference, end: reference });
      }
      previousMissing = !interval;
    }

    return missing.length
      ? Result.err(new CurveCoverageError(this.id, missing))
      : Result.ok(values);
  }

  private isUnchanged(content: CurveContent): boolean {
    const { name, description, intervals } = this.props;
    return (
      content.name === name &&
      content.description === description &&
      content.intervals.length === intervals.length &&
      content.intervals.every((interval, i) => interval.equals(intervals[i]))
    );
  }

  private findInterval(reference: CalendarDate): CurveInterval | undefined {
    let low = 0;
    let high = this.props.intervals.length - 1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const interval = this.props.intervals[middle];
      if (reference.isBefore(interval.range.start)) high = middle - 1;
      else if (reference.isAfter(interval.range.end)) low = middle + 1;
      else return interval;
    }
    return undefined;
  }

  static conventionOf(index: EEconomicIndex): EIndexValueConvention {
    return index === EEconomicIndex.IPCA
      ? EIndexValueConvention.MONTHLY_VARIATION
      : EIndexValueConvention.ANNUAL_EFFECTIVE_252;
  }

  private static normalize(content: CurveContent): CurveContent {
    return {
      name: content.name.trim(),
      description: content.description?.trim() || null,
      intervals: sortIntervals(content.intervals),
    };
  }

  private static validate(
    index: EEconomicIndex,
    { name, intervals }: CurveContent,
  ): InvalidCurveError | null {
    if (!name.length) {
      return new InvalidCurveError('Informe o nome da curva.');
    }
    if (intervals.length === 0) {
      return new InvalidCurveError('Informe ao menos um intervalo.');
    }

    const monthly =
      Curve.conventionOf(index) === EIndexValueConvention.MONTHLY_VARIATION;
    for (let i = 0; i < intervals.length; i++) {
      const interval = intervals[i];
      if (!monthly && interval.value.value.lessThan(0)) {
        return new InvalidCurveError('As taxas não podem ser negativas.');
      }
      if (
        monthly &&
        (!interval.range.start.isFirstDayOfMonth() ||
          !interval.range.end.isLastDayOfMonth())
      ) {
        return new InvalidCurveError(
          'Intervalos mensais devem cobrir meses completos.',
        );
      }
      if (i > 0 && intervals[i - 1].range.overlaps(interval.range)) {
        return new InvalidCurveError('Os intervalos não podem se sobrepor.', {
          start: interval.range.start.toIsoString(),
        });
      }
    }
    return null;
  }
}

function sortIntervals(
  intervals: readonly CurveInterval[],
): readonly CurveInterval[] {
  return [...intervals].sort(
    (a, b) => a.range.start.daysUntil(b.range.start) * -1,
  );
}
