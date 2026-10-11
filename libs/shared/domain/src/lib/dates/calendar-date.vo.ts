import { EAppErrorCode } from '../foundations/app-error-code.enum';
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
    super(reason, {
      code: EAppErrorCode.INVALID_CALENDAR_DATE,
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
        new InvalidCalendarDateError(
          'Data inválida. Use o formato AAAA-MM-DD.',
          value,
        ),
      );
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year < 1) {
      return Result.err(
        new InvalidCalendarDateError(
          'O ano deve estar entre 0001 e 9999.',
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
        new InvalidCalendarDateError(
          'Esta data não existe no calendário.',
          value,
        ),
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
      return Result.err(new InvalidCalendarDateError('Data inválida.'));
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
      throw new InvalidCalendarDateError(
        'O deslocamento de dias deve ser um número inteiro.',
      );
    }

    const result = CalendarDate.fromUtcDate(
      new Date((this.epochDay + days) * MILLISECONDS_PER_DAY),
    );
    if (result.isErr()) throw result.error;
    return result.value;
  }

  // Keeps the day of month, clamped to the target month's last day.
  addMonths(months: number): CalendarDate {
    if (!Number.isInteger(months)) {
      throw new InvalidCalendarDateError(
        'O deslocamento de meses deve ser um número inteiro.',
      );
    }

    const monthIndex = this.year * 12 + this.month - 1 + months;
    const year = Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    const firstOfMonth = CalendarDate.of(
      `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`,
    );
    return firstOfMonth.addDays(
      Math.min(this.day, firstOfMonth.daysInMonth) - 1,
    );
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
