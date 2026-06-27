import {
  areIntervalsOverlapping,
  differenceInDays,
  isAfter,
  isEqual,
  isWithinInterval,
} from 'date-fns';
import { DomainError } from '../../errors/domain.error';
import { Result } from '../../result/result';
import { ValueObject } from '../value-object.base';

export class InvalidDateRangeError extends DomainError {
  constructor() {
    super('DateRange end must be after start');
  }
}

export class DateRange extends ValueObject<DateRange> {
  private constructor(
    readonly start: Date,
    readonly end: Date,
  ) {
    super();
  }

  static create(
    start: Date,
    end: Date,
  ): Result<DateRange, InvalidDateRangeError> {
    if (!isAfter(end, start)) return Result.err(new InvalidDateRangeError());
    return Result.ok(new DateRange(start, end));
  }

  static of(start: Date, end: Date): DateRange {
    const result = DateRange.create(start, end);
    if (result.isErr()) throw result.error;
    return result.value;
  }

  lengthInDays(): number {
    return differenceInDays(this.end, this.start);
  }

  contains(date: Date): boolean {
    return isWithinInterval(date, { start: this.start, end: this.end });
  }

  overlaps(other: DateRange): boolean {
    return areIntervalsOverlapping(
      { start: this.start, end: this.end },
      { start: other.start, end: other.end },
    );
  }

  isExpired(at: Date = new Date()): boolean {
    return isAfter(at, this.end);
  }

  equals(other: DateRange): boolean {
    return isEqual(this.start, other.start) && isEqual(this.end, other.end);
  }
}
