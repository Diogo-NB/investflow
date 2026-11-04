import {
  AggregateRoot,
  CalendarDate,
  generateUuid,
  Result,
  Revision,
  UtcInstant,
} from '@investflow/shared-domain';
import { EPublishedIndex } from './published-index.enum';
import { PublishedIndexValue } from './published-index-value.vo';
import {
  PublishedIndexValueOutOfOrderError,
  PublishedIndexValueOutsideYearError,
} from './published-index-series.error';
import { PublishedIndexValuesImported } from './published-index-series.events';

interface PublishedIndexSeriesProps {
  readonly index: EPublishedIndex;
  readonly year: number;
  values: readonly PublishedIndexValue[];
}

export interface ReconstitutePublishedIndexSeriesProps
  extends PublishedIndexSeriesProps {
  readonly id: string;
  readonly revision: number;
}

// One index's values for one year, so a load stays bounded however long the
// series runs. Values are sorted by date and never change.
export class PublishedIndexSeries extends AggregateRoot {
  private constructor(
    id: string,
    private readonly props: PublishedIndexSeriesProps,
    revision: Revision,
  ) {
    super(id, revision);
  }

  static create(index: EPublishedIndex, year: number): PublishedIndexSeries {
    return new PublishedIndexSeries(
      generateUuid(),
      { index, year, values: [] },
      Revision.initial(),
    );
  }

  static reconstitute(
    props: ReconstitutePublishedIndexSeriesProps,
  ): PublishedIndexSeries {
    const { id, revision, ...state } = props;
    return new PublishedIndexSeries(id, state, Revision.restore(revision));
  }

  get index(): EPublishedIndex {
    return this.props.index;
  }

  get year(): number {
    return this.props.year;
  }

  get values(): readonly PublishedIndexValue[] {
    return [...this.props.values];
  }

  get lastReferenceDate(): CalendarDate | null {
    const { values } = this.props;
    return values.length > 0 ? values[values.length - 1].referenceDate : null;
  }

  append(
    values: readonly PublishedIndexValue[],
    occurredAt: UtcInstant,
  ): Result<
    this,
    PublishedIndexValueOutOfOrderError | PublishedIndexValueOutsideYearError
  > {
    let last = this.lastReferenceDate;
    for (const { referenceDate } of values) {
      if (referenceDate.year !== this.props.year) {
        return Result.err(
          new PublishedIndexValueOutsideYearError(
            this.id,
            this.props.year,
            referenceDate,
          ),
        );
      }
      if (last && !referenceDate.isAfter(last)) {
        return Result.err(
          new PublishedIndexValueOutOfOrderError(this.id, referenceDate),
        );
      }
      last = referenceDate;
    }

    this.props.values = [...this.props.values, ...values];
    this.revisionTracker.increment();
    return Result.ok(
      this.apply(
        new PublishedIndexValuesImported(
          this.id,
          this.props.index,
          values,
          occurredAt,
        ),
      ),
    );
  }
}
