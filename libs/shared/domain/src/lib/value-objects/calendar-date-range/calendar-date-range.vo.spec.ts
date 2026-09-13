import { CalendarDate } from '../calendar-date/calendar-date.vo';
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

  it.each([
    [end, start],
    [start, start],
  ])(
    'rejects a range whose end is not after its start',
    (rangeStart, rangeEnd) => {
      const result = CalendarDateRange.create(rangeStart, rangeEnd);

      expect(result.isErr()).toBe(true);
      expect(result.error).toBeInstanceOf(InvalidCalendarDateRangeError);
      expect(result.error.code).toBe('INVALID_CALENDAR_DATE_RANGE');
    },
  );

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
