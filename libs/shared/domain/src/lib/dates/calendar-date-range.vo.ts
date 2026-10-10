import { DomainError } from '../foundations/domain.error';
import { Result } from '../foundations/result';
import { ValueObject } from '../foundations/value-object.base';
import { CalendarDate } from './calendar-date.vo';

export class InvalidCalendarDateRangeError extends DomainError {
  constructor() {
    super('CalendarDateRange end must be on or after start', {
      code: 'INVALID_CALENDAR_DATE_RANGE',
    });
  }
}

export class CalendarDateRange extends ValueObject<CalendarDateRange> {
  private dates?: readonly CalendarDate[];

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
    if (start.isAfter(end)) {
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

  // Every calendar day in order, both endpoints included. Computed on first
  // access and reused; readonly so callers cannot alter the shared list.
  get datesBetween(): readonly CalendarDate[] {
    if (!this.dates) {
      const dates: CalendarDate[] = [];
      for (
        let date = this.start;
        !date.isAfter(this.end);
        date = date.addDays(1)
      ) {
        dates.push(date);
      }
      this.dates = dates;
    }
    return this.dates;
  }

  isExpired(at: CalendarDate): boolean {
    return at.isAfter(this.end);
  }

  equals(other: CalendarDateRange): boolean {
    return this.start.equals(other.start) && this.end.equals(other.end);
  }
}
