import { DomainError } from '../foundations/domain.error';
import { Result } from '../foundations/result';
import { ValueObject } from '../foundations/value-object.base';
import { CalendarDate } from './calendar-date.vo';

export class InvalidCalendarDateRangeError extends DomainError {
  constructor() {
    super('CalendarDateRange end must be after start', {
      code: 'INVALID_CALENDAR_DATE_RANGE',
    });
  }
}

export class CalendarDateRange extends ValueObject<CalendarDateRange> {
  private constructor(
    readonly start: CalendarDate,
    readonly end: CalendarDate,
  ) {
    super();
  }

  static create(
    start: CalendarDate,
    end: CalendarDate,
  ): Result<CalendarDateRange, InvalidCalendarDateRangeError> {
    if (!start.isBefore(end)) {
      return Result.err(new InvalidCalendarDateRangeError());
    }

    return Result.ok(new CalendarDateRange(start, end));
  }

  static of(start: CalendarDate, end: CalendarDate): CalendarDateRange {
    const result = CalendarDateRange.create(start, end);
    if (result.isErr()) throw result.error;
    return result.value;
  }

  lengthInDays(): number {
    return this.start.daysUntil(this.end);
  }

  contains(date: CalendarDate): boolean {
    return !date.isBefore(this.start) && !date.isAfter(this.end);
  }

  overlaps(other: CalendarDateRange): boolean {
    return !this.start.isAfter(other.end) && !other.start.isAfter(this.end);
  }

  isExpired(at: CalendarDate): boolean {
    return at.isAfter(this.end);
  }

  equals(other: CalendarDateRange): boolean {
    return this.start.equals(other.start) && this.end.equals(other.end);
  }
}
