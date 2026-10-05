import {
  CalendarDate,
  CalendarDateRange,
  ValueObject,
} from '@investflow/shared-domain';
import { IndexValue } from './index-value.vo';

export class IndexCurveInterval extends ValueObject<IndexCurveInterval> {
  private constructor(
    readonly range: CalendarDateRange,
    readonly value: IndexValue,
  ) {
    super();
  }

  static create(
    range: CalendarDateRange,
    value: IndexValue,
  ): IndexCurveInterval {
    return new IndexCurveInterval(range, value);
  }

  contains(reference: CalendarDate): boolean {
    return this.range.contains(reference);
  }

  equals(other: IndexCurveInterval): boolean {
    return this.range.equals(other.range) && this.value.equals(other.value);
  }
}
