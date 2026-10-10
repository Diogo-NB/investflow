import { EAppErrorCode } from '../foundations/app-error-code.enum';
import { DomainError } from '../foundations/domain.error';
import { Result } from '../foundations/result';
import { ValueObject } from '../foundations/value-object.base';
import { CalendarDate } from './calendar-date.vo';

const ISO_INSTANT_WITH_OFFSET_PATTERN =
  /^(\d{4}-\d{2}-\d{2})T.+(?:Z|[+-]\d{2}:\d{2})$/;

export class InvalidUtcInstantError extends DomainError {
  constructor(reason: string, value?: string | number) {
    super(reason, {
      code: EAppErrorCode.INVALID_UTC_INSTANT,
      metadata: value === undefined ? { reason } : { reason, value },
    });
  }
}

export class UtcInstant extends ValueObject<UtcInstant> {
  private constructor(private readonly dateValue: Date) {
    super();
  }

  static fromIso(value: string): Result<UtcInstant, InvalidUtcInstantError> {
    const match = ISO_INSTANT_WITH_OFFSET_PATTERN.exec(value);
    if (!match) {
      return Result.err(
        new InvalidUtcInstantError(
          'Data e hora inválidas. Use o formato ISO com fuso horário.',
          value,
        ),
      );
    }

    const calendarDateResult = CalendarDate.create(match[1]);
    if (calendarDateResult.isErr()) {
      return Result.err(
        new InvalidUtcInstantError('Data e hora inválidas.', value),
      );
    }

    return UtcInstant.fromDate(new Date(value));
  }

  static ofIso(value: string): UtcInstant {
    const result = UtcInstant.fromIso(value);
    if (result.isErr()) throw result.error;
    return result.value;
  }

  static fromDate(value: Date): Result<UtcInstant, InvalidUtcInstantError> {
    const epochMilliseconds = value.getTime();
    if (Number.isNaN(epochMilliseconds)) {
      return Result.err(new InvalidUtcInstantError('Data e hora inválidas.'));
    }

    return Result.ok(new UtcInstant(new Date(epochMilliseconds)));
  }

  static fromEpochMilliseconds(
    value: number,
  ): Result<UtcInstant, InvalidUtcInstantError> {
    if (!Number.isInteger(value) || Number.isNaN(new Date(value).getTime())) {
      return Result.err(
        new InvalidUtcInstantError('Data e hora inválidas.', value),
      );
    }

    return UtcInstant.fromDate(new Date(value));
  }

  static ofEpochMilliseconds(value: number): UtcInstant {
    const result = UtcInstant.fromEpochMilliseconds(value);
    if (result.isErr()) throw result.error;
    return result.value;
  }

  get epochMilliseconds(): number {
    return this.dateValue.getTime();
  }

  get date(): Date {
    return new Date(this.dateValue.getTime());
  }

  override toString(): string {
    return this.toISOString();
  }

  toISOString(): string {
    return this.dateValue.toISOString();
  }

  toJSON(): string {
    return this.toISOString();
  }

  isBefore(other: UtcInstant): boolean {
    return this.dateValue.getTime() < other.dateValue.getTime();
  }

  isAfter(other: UtcInstant): boolean {
    return this.dateValue.getTime() > other.dateValue.getTime();
  }

  isOnOrBefore(other: UtcInstant): boolean {
    return !this.isAfter(other);
  }

  isOnOrAfter(other: UtcInstant): boolean {
    return !this.isBefore(other);
  }

  equals(other: UtcInstant): boolean {
    return this.dateValue.getTime() === other.dateValue.getTime();
  }
}
