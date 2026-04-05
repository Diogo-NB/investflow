import {
  areIntervalsOverlapping,
  differenceInDays,
  isAfter,
  isEqual,
  isWithinInterval,
} from 'date-fns';
import { DomainError } from '../../errors/domain.error';
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

  static of(start: Date, end: Date): DateRange {
    if (!isAfter(end, start)) throw new InvalidDateRangeError();
    return new DateRange(start, end);
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
