import {
  CalendarDate,
  CalendarDateRange,
  ValueObject,
} from '@investflow/shared-domain';
import { IndexValue } from './index-value.vo';

export class CurveInterval extends ValueObject<CurveInterval> {
  private constructor(
    readonly range: CalendarDateRange,
    readonly value: IndexValue,
  ) {
    super();
  }

  static create(range: CalendarDateRange, value: IndexValue): CurveInterval {
    return new CurveInterval(range, value);
  }

  contains(reference: CalendarDate): boolean {
    return this.range.contains(reference);
  }

  equals(other: CurveInterval): boolean {
    return this.range.equals(other.range) && this.value.equals(other.value);
  }
}
