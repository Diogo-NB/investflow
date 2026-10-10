import {
  AggregateRoot,
  CalendarDate,
  generateUuid,
  Result,
  UtcInstant,
} from '@investflow/shared-domain';
import { EEconomicIndex } from './economic-index.enum';
import { IndexCurveInterval } from './index-curve-interval.vo';
import {
  IndexCurveCoverageError,
  IndexCurveValueNotFoundError,
  InvalidIndexCurveError,
} from './index-curve.error';
import { EIndexValueConvention } from './index-value-convention.enum';
import { IndexValue } from './index-value.vo';

interface IndexCurveProps {
  readonly name: string;
  readonly description: string | null;
  readonly index: EEconomicIndex;
  readonly intervals: readonly IndexCurveInterval[];
  deletedAt: UtcInstant | null;
}

export type CreateIndexCurveProps = Omit<
  IndexCurveProps,
  'description' | 'deletedAt'
> & {
  readonly description?: string | null;
};

export type ReconstituteIndexCurveProps = IndexCurveProps & {
  readonly id: string;
};

export class IndexCurve extends AggregateRoot {
  private constructor(
    id: string,
    private readonly props: IndexCurveProps,
  ) {
    super(id);
  }

  static create(
    props: CreateIndexCurveProps,
  ): Result<IndexCurve, InvalidIndexCurveError> {
    const curve = new IndexCurve(generateUuid(), {
      name: props.name.trim(),
      description: props.description?.trim() || null,
      index: props.index,
      deletedAt: null,
      intervals: [...props.intervals].sort(
        (a, b) => a.range.start.daysUntil(b.range.start) * -1,
      ),
    });
    return curve.validate();
  }

  static reconstitute(props: ReconstituteIndexCurveProps): IndexCurve {
    return new IndexCurve(props.id, {
      name: props.name,
      description: props.description,
      index: props.index,
      deletedAt: props.deletedAt,
      intervals: [...props.intervals].sort(
        (a, b) => a.range.start.daysUntil(b.range.start) * -1,
      ),
    });
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | null {
    return this.props.description;
  }

  get index(): EEconomicIndex {
    return this.props.index;
  }

  get convention(): EIndexValueConvention {
    return this.props.index === EEconomicIndex.IPCA
      ? EIndexValueConvention.MONTHLY_VARIATION
      : EIndexValueConvention.ANNUAL_EFFECTIVE_252;
  }

  get intervals(): readonly IndexCurveInterval[] {
    return [...this.props.intervals];
  }

  get deletedAt(): UtcInstant | null {
    return this.props.deletedAt;
  }

  delete(at: UtcInstant): this {
    if (!this.props.deletedAt) this.props.deletedAt = at;
    return this;
  }

  valueAt(
    reference: CalendarDate,
  ): Result<IndexValue, IndexCurveValueNotFoundError> {
    const interval = this.findInterval(reference);
    return interval === undefined
      ? Result.err(new IndexCurveValueNotFoundError(this.id, reference))
      : Result.ok(interval.value);
  }

  // Resolves all references or reports every uncovered one, never a partial list.
  valuesAt(
    references: readonly CalendarDate[],
  ): Result<IndexValue[], IndexCurveCoverageError> {
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
      ? Result.err(new IndexCurveCoverageError(this.id, missing))
      : Result.ok(values);
  }

  private validate(): Result<this, InvalidIndexCurveError> {
    const name = this.props.name;
    if (!name.length) {
      return Result.err(new InvalidIndexCurveError('Informe o nome da curva.'));
    }
    const monthly = this.convention === EIndexValueConvention.MONTHLY_VARIATION;
    if (this.props.intervals.length === 0) {
      return Result.err(
        new InvalidIndexCurveError('Informe ao menos um intervalo.'),
      );
    }
    const intervals = this.props.intervals;
    for (let i = 0; i < intervals.length; i++) {
      const interval = intervals[i];
      if (!monthly && interval.value.value.lessThan(0)) {
        return Result.err(
          new InvalidIndexCurveError('As taxas não podem ser negativas.'),
        );
      }
      if (
        monthly &&
        (!interval.range.start.isFirstDayOfMonth() ||
          !interval.range.end.isLastDayOfMonth())
      ) {
        return Result.err(
          new InvalidIndexCurveError(
            'Intervalos mensais devem cobrir meses completos.',
          ),
        );
      }
      if (i > 0 && intervals[i - 1].range.overlaps(interval.range)) {
        return Result.err(
          new InvalidIndexCurveError('Os intervalos não podem se sobrepor.', {
            start: interval.range.start.toIsoString(),
          }),
        );
      }
    }
    return Result.ok(this);
  }

  private findInterval(
    reference: CalendarDate,
  ): IndexCurveInterval | undefined {
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
}
