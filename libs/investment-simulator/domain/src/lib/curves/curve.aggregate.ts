import {
  BusinessDayCalendar,
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
  CurveIntervalGapError,
  CurveRevisionConflictError,
  CurveValueNotFoundError,
  InvalidCurveError,
} from './curve.error';
import {
  CurveCreated,
  CurveDeleted,
  CurveDetailsChanged,
  CurveValuesChanged,
} from './curve.events';
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
  readonly valuesRevision: number;
};

export type CurveEdit = Partial<CurveContent>;

export type CurveContentError = InvalidCurveError | CurveIntervalGapError;

export class Curve extends AggregateRoot {
  private constructor(
    id: string,
    private readonly props: CurveProps,
    revision: Revision,
    // Raised only by changes to what a calculation reads, so results stay
    // current across renames.
    private readonly valuesRevisionTracker: Revision,
  ) {
    super(id, revision);
  }

  static create(
    props: CreateCurveProps,
    occurredAt: UtcInstant,
  ): Result<Curve, CurveContentError> {
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
      Revision.initial(),
    );
    return Result.ok(curve.apply(new CurveCreated(curve.id, occurredAt)));
  }

  static reconstitute(props: ReconstituteCurveProps): Curve {
    const { id, revision, valuesRevision, ...state } = props;
    return new Curve(
      id,
      { ...state, intervals: sortIntervals(state.intervals) },
      Revision.restore(revision),
      Revision.restore(valuesRevision),
    );
  }

  get valuesRevision(): number {
    return this.valuesRevisionTracker.value;
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
  ): Result<Curve, CurveContentError> {
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
  ): Result<this, CurveContentError> {
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

    const valuesChanged = !this.hasIntervals(content.intervals);
    const detailsChanged =
      content.name !== this.props.name ||
      content.description !== this.props.description;
    if (!valuesChanged && !detailsChanged) return Result.ok(this);

    this.props.name = content.name;
    this.props.description = content.description;
    this.props.intervals = content.intervals;
    this.revisionTracker.increment();
    if (valuesChanged) {
      this.valuesRevisionTracker.increment();
      this.apply(new CurveValuesChanged(this.id, occurredAt));
    }
    if (detailsChanged)
      this.apply(new CurveDetailsChanged(this.id, occurredAt));
    return Result.ok(this);
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

  override markPersisted(): this {
    this.valuesRevisionTracker.markPersisted();
    return super.markPersisted();
  }

  private hasIntervals(other: readonly CurveInterval[]): boolean {
    const { intervals } = this.props;
    return (
      other.length === intervals.length &&
      other.every((interval, i) => interval.equals(intervals[i]))
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
  ): CurveContentError | null {
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
        (!interval.range.start.isFirstDayOfMonth ||
          !interval.range.end.isLastDayOfMonth)
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
    return Curve.firstGap(monthly, intervals);
  }

  // Monthly curves need every month; daily curves need every business day,
  // the only days a calculation reads.
  private static firstGap(
    monthly: boolean,
    intervals: readonly CurveInterval[],
  ): CurveIntervalGapError | null {
    for (let i = 1; i < intervals.length; i++) {
      const after = intervals[i - 1].range.end.addDays(1);
      const next = intervals[i].range.start;
      if (monthly) {
        if (after.isBefore(next)) {
          return new CurveIntervalGapError(after, next.addDays(-1));
        }
        continue;
      }
      let first = after;
      while (
        first.isBefore(next) &&
        !BusinessDayCalendar.isBusinessDay(first)
      ) {
        first = first.addDays(1);
      }
      if (!first.isBefore(next)) continue;
      let last = next.addDays(-1);
      while (!BusinessDayCalendar.isBusinessDay(last)) last = last.addDays(-1);
      return new CurveIntervalGapError(first, last);
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
