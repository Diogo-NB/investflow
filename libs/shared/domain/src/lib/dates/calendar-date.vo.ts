import { DomainError } from '../foundations/domain.error';
import { Result } from '../foundations/result';
import { ValueObject } from '../foundations/value-object.base';
import type { UtcInstant } from './utc-instant.vo';

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MILLISECONDS_PER_DAY = 86_400_000;
const SUNDAY = 0;
const SATURDAY = 6;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export class InvalidCalendarDateError extends DomainError {
  constructor(reason: string, value?: string) {
    super(`Invalid calendar date: ${reason}`, {
      code: 'INVALID_CALENDAR_DATE',
      metadata: value === undefined ? { reason } : { reason, value },
    });
  }
}

export class CalendarDate extends ValueObject<CalendarDate> {
  private constructor(
    readonly value: string,
    readonly year: number,
    readonly month: number,
    readonly day: number,
    private readonly epochDay: number,
  ) {
    super();
  }

  static create(value: string): Result<CalendarDate, InvalidCalendarDateError> {
    const match = CALENDAR_DATE_PATTERN.exec(value);
    if (!match) {
      return Result.err(
        new InvalidCalendarDateError('expected YYYY-MM-DD', value),
      );
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year < 1) {
      return Result.err(
        new InvalidCalendarDateError(
          'year must be between 0001 and 9999',
          value,
        ),
      );
    }

    const utcDate = createUtcDate(year, month, day);
    if (
      utcDate.getUTCFullYear() !== year ||
      utcDate.getUTCMonth() !== month - 1 ||
      utcDate.getUTCDate() !== day
    ) {
      return Result.err(
        new InvalidCalendarDateError('invalid calendar day', value),
      );
    }

    return Result.ok(
      new CalendarDate(
        value,
        year,
        month,
        day,
        utcDate.getTime() / MILLISECONDS_PER_DAY,
      ),
    );
  }

  static of(value: string): CalendarDate {
    const result = CalendarDate.create(value);
    if (result.isErr()) throw result.error;
    return result.value;
  }

  static fromUtcDate(
    value: Date,
  ): Result<CalendarDate, InvalidCalendarDateError> {
    if (Number.isNaN(value.getTime())) {
      return Result.err(new InvalidCalendarDateError('invalid native Date'));
    }

    return CalendarDate.create(formatUtcDate(value));
  }

  static fromUtcInstant(
    value: UtcInstant,
  ): Result<CalendarDate, InvalidCalendarDateError> {
    return CalendarDate.fromUtcDate(value.date);
  }

  get daysInMonth(): number {
    if (this.month === 2) {
      const leapYear =
        this.year % 4 === 0 && (this.year % 100 !== 0 || this.year % 400 === 0);
      return leapYear ? 29 : 28;
    }
    return DAYS_IN_MONTH[this.month - 1];
  }

  override toString(): string {
    return this.toIsoString();
  }

  toIsoString(): string {
    return this.value;
  }

  toPtBrString(): string {
    return `${this.value.slice(8, 10)}/${this.value.slice(5, 7)}/${this.value.slice(0, 4)}`;
  }

  toJSON(): string {
    return this.toIsoString();
  }

  toUtcDate(): Date {
    return new Date(this.epochDay * MILLISECONDS_PER_DAY);
  }

  addDays(days: number): CalendarDate {
    if (!Number.isInteger(days)) {
      throw new InvalidCalendarDateError('day offset must be an integer');
    }

    const result = CalendarDate.fromUtcDate(
      new Date((this.epochDay + days) * MILLISECONDS_PER_DAY),
    );
    if (result.isErr()) throw result.error;
    return result.value;
  }

  daysUntil(other: CalendarDate): number {
    return other.epochDay - this.epochDay;
  }

  isBefore(other: CalendarDate): boolean {
    return this.epochDay < other.epochDay;
  }

  isAfter(other: CalendarDate): boolean {
    return this.epochDay > other.epochDay;
  }

  isOnOrBefore(other: CalendarDate): boolean {
    return !this.isAfter(other);
  }

  isOnOrAfter(other: CalendarDate): boolean {
    return !this.isBefore(other);
  }

  isWeekend(): boolean {
    const dayOfWeek = this.toUtcDate().getUTCDay();
    return dayOfWeek === SUNDAY || dayOfWeek === SATURDAY;
  }

  isFirstDayOfMonth(): boolean {
    return this.day === 1;
  }

  isLastDayOfMonth(): boolean {
    return this.day === this.daysInMonth;
  }

  equals(other: CalendarDate): boolean {
    return this.epochDay === other.epochDay;
  }
}

function createUtcDate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

function formatUtcDate(date: Date): string {
  const year = date.getUTCFullYear().toString().padStart(4, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}
