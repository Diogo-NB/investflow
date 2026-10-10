import { CalendarDate } from './calendar-date.vo';
import {
  CalendarDateRange,
  InvalidCalendarDateRangeError,
} from './calendar-date-range.vo';

describe('CalendarDateRange', () => {
  const start = CalendarDate.of('2026-01-01');
  const end = CalendarDate.of('2026-01-31');

  it('creates an ordered range', () => {
    const result = CalendarDateRange.create(start, end);

    expect(result.isOk()).toBe(true);
    expect(result.value.start).toBe(start);
    expect(result.value.end).toBe(end);
    expect(result.value.lengthInDays()).toBe(30);
  });

  it('rejects a reversed range', () => {
    const result = CalendarDateRange.create(end, start);
    expect(result.isErr()).toBe(true);
    expect(result.error).toBeInstanceOf(InvalidCalendarDateRangeError);
    expect(result.error.code).toBe('INVALID_CALENDAR_DATE_RANGE');
  });

  it('accepts a single-day range without changing elapsed-day semantics', () => {
    const range = CalendarDateRange.of(start, start);
    expect(range.lengthInDays()).toBe(0);
    expect(range.contains(start)).toBe(true);
    expect(range.contains(start.addDays(1))).toBe(false);
    expect(range.overlaps(CalendarDateRange.of(start, end))).toBe(true);
  });

  it('contains both endpoints and dates between them', () => {
    const range = CalendarDateRange.of(start, end);

    expect(range.contains(start)).toBe(true);
    expect(range.contains(CalendarDate.of('2026-01-15'))).toBe(true);
    expect(range.contains(end)).toBe(true);
    expect(range.contains(CalendarDate.of('2026-02-01'))).toBe(false);
  });

  it('treats ranges sharing an endpoint as overlapping', () => {
    const range = CalendarDateRange.of(start, end);
    const other = CalendarDateRange.of(end, CalendarDate.of('2026-02-10'));

    expect(range.overlaps(other)).toBe(true);
  });

  it('lists every day in order including both endpoints', () => {
    const dates = CalendarDateRange.of(
      CalendarDate.of('2024-02-28'),
      CalendarDate.of('2024-03-01'),
    ).datesBetween();

    expect(dates.map((date) => date.toIsoString())).toEqual([
      '2024-02-28',
      '2024-02-29',
      '2024-03-01',
    ]);
  });

  it('lists the single day of a one-day range', () => {
    const day = CalendarDate.of('2026-01-02');

    expect(CalendarDateRange.of(day, day).datesBetween()).toEqual([day]);
  });

  it('requires an explicit date when checking expiration', () => {
    const range = CalendarDateRange.of(start, end);

    expect(range.isExpired(end)).toBe(false);
    expect(range.isExpired(CalendarDate.of('2026-02-01'))).toBe(true);
  });

  it('compares ranges by value', () => {
    const range = CalendarDateRange.of(start, end);
    const equalRange = CalendarDateRange.of(
      CalendarDate.of('2026-01-01'),
      CalendarDate.of('2026-01-31'),
    );

    expect(range.equals(equalRange)).toBe(true);
  });
});
