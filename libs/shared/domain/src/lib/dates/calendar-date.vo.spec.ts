import { EAppErrorCode } from '../foundations/app-error-code.enum';
import { CalendarDate, InvalidCalendarDateError } from './calendar-date.vo';
import { UtcInstant } from './utc-instant.vo';

describe('CalendarDate', () => {
  it.each([
    ['2024-02-01', true, false],
    ['2024-02-28', false, false],
    ['2024-02-29', false, true],
    ['2026-02-28', false, true],
    ['2026-04-30', false, true],
    ['1900-02-28', false, true],
    ['2000-02-28', false, false],
    ['2000-02-29', false, true],
    ['2100-02-28', false, true],
    ['0004-02-29', false, true],
    ['9999-12-31', false, true],
    ['0001-01-01', true, false],
  ] as const)('recognizes month boundaries for %s', (date, first, last) => {
    const value = CalendarDate.of(date);
    expect(value.isFirstDayOfMonth()).toBe(first);
    expect(value.isLastDayOfMonth()).toBe(last);
  });

  it.each([
    ['2026-01-02', 2026, 1, 2, 31],
    ['2026-02-28', 2026, 2, 28, 28],
    ['2024-02-29', 2024, 2, 29, 29],
    ['2026-03-01', 2026, 3, 1, 31],
    ['2026-04-01', 2026, 4, 1, 30],
    ['2026-05-01', 2026, 5, 1, 31],
    ['2026-06-01', 2026, 6, 1, 30],
    ['2026-07-01', 2026, 7, 1, 31],
    ['2026-08-01', 2026, 8, 1, 31],
    ['2026-09-01', 2026, 9, 1, 30],
    ['2026-10-01', 2026, 10, 1, 31],
    ['2026-11-01', 2026, 11, 1, 30],
    ['9999-12-31', 9999, 12, 31, 31],
    ['0001-01-01', 1, 1, 1, 31],
    ['1900-02-28', 1900, 2, 28, 28],
    ['2000-02-29', 2000, 2, 29, 29],
    ['2100-02-28', 2100, 2, 28, 28],
  ] as const)(
    'exposes calendar parts and month length for %s',
    (value, year, month, day, daysInMonth) => {
      const date = CalendarDate.of(value);
      expect(date.year).toBe(year);
      expect(date.month).toBe(month);
      expect(date.day).toBe(day);
      expect(date.daysInMonth).toBe(daysInMonth);
    },
  );

  describe('create', () => {
    it.each(['2026-1-02', '2026-01-2', '01-02-2026', 'not-a-date'])(
      'rejects malformed value %s',
      (value) => {
        const result = CalendarDate.create(value);

        expect(result.isErr()).toBe(true);
        expect(result.error).toBeInstanceOf(InvalidCalendarDateError);
        expect(result.error.code).toBe(EAppErrorCode.INVALID_CALENDAR_DATE);
      },
    );

    it.each([
      '0000-01-01',
      '2026-02-29',
      '2026-04-31',
      '1900-02-29',
      '2100-02-29',
    ])('rejects invalid calendar date %s', (value) => {
      expect(CalendarDate.create(value).isErr()).toBe(true);
    });

    it('accepts leap days and years below 100', () => {
      expect(CalendarDate.of('2024-02-29').toString()).toBe('2024-02-29');
      expect(CalendarDate.of('0001-01-01').toString()).toBe('0001-01-01');
      expect(CalendarDate.of('0099-12-31').toString()).toBe('0099-12-31');
    });
  });

  it('formats a calendar date as DD/MM/YYYY', () => {
    const date = CalendarDate.of('2026-01-02');

    expect(date.toIsoString()).toBe('2026-01-02');
    expect(date.toPtBrString()).toBe('02/01/2026');
  });

  it('serializes to its canonical ISO scalar in JSON', () => {
    expect(JSON.stringify({ date: CalendarDate.of('2026-01-02') })).toBe(
      '{"date":"2026-01-02"}',
    );
  });

  it('creates a calendar date from UTC native Date components', () => {
    const result = CalendarDate.fromUtcDate(
      new Date('2026-01-02T23:59:59.999Z'),
    );

    expect(result.value.toString()).toBe('2026-01-02');
    expect(result.value.year).toBe(2026);
    expect(result.value.month).toBe(1);
    expect(result.value.day).toBe(2);
  });

  it('creates the UTC calendar date represented by a UTC instant', () => {
    const instant = UtcInstant.ofIso('2026-01-01T23:30:00-03:00');

    const result = CalendarDate.fromUtcInstant(instant);

    expect(result.value.toIsoString()).toBe('2026-01-02');
  });

  it('rejects an invalid native Date', () => {
    expect(CalendarDate.fromUtcDate(new Date('invalid')).isErr()).toBe(true);
  });

  it('returns defensive native Date values', () => {
    const calendarDate = CalendarDate.of('2026-01-02');
    const nativeDate = calendarDate.toUtcDate();

    nativeDate.setUTCFullYear(2030);

    expect(calendarDate.toString()).toBe('2026-01-02');
    expect(calendarDate.toUtcDate().toISOString()).toBe(
      '2026-01-02T00:00:00.000Z',
    );
  });

  it('performs calendar arithmetic across month and year boundaries', () => {
    const date = CalendarDate.of('2025-12-31');

    expect(date.addDays(1).toString()).toBe('2026-01-01');
    expect(date.addDays(-31).toString()).toBe('2025-11-30');
    expect(date.daysUntil(CalendarDate.of('2026-01-10'))).toBe(10);
    expect(CalendarDate.of('2026-01-10').daysUntil(date)).toBe(-10);
  });

  it('rejects non-integer day offsets', () => {
    expect(() => CalendarDate.of('2026-01-01').addDays(1.5)).toThrow(
      InvalidCalendarDateError,
    );
  });

  it('adds months keeping the day, clamped to the end of the month', () => {
    expect(CalendarDate.of('2026-01-02').addMonths(9).toString()).toBe(
      '2026-10-02',
    );
    expect(CalendarDate.of('2026-05-31').addMonths(9).toString()).toBe(
      '2027-02-28',
    );
    expect(CalendarDate.of('2027-05-31').addMonths(9).toString()).toBe(
      '2028-02-29',
    );
    expect(CalendarDate.of('2026-03-31').addMonths(-1).toString()).toBe(
      '2026-02-28',
    );
    expect(() => CalendarDate.of('2026-01-01').addMonths(0.5)).toThrow(
      InvalidCalendarDateError,
    );
  });

  it('keeps calendar parts consistent when arithmetic crosses a leap month', () => {
    const leapDay = CalendarDate.of('2024-02-28').addDays(1);
    expect(leapDay.year).toBe(2024);
    expect(leapDay.month).toBe(2);
    expect(leapDay.day).toBe(29);
    expect(leapDay.isLastDayOfMonth()).toBe(true);
    const march = leapDay.addDays(1);
    expect(march.year).toBe(2024);
    expect(march.month).toBe(3);
    expect(march.day).toBe(1);
    expect(march.daysInMonth).toBe(31);
    expect(march.isFirstDayOfMonth()).toBe(true);
  });

  it('compares dates and identifies weekends', () => {
    const friday = CalendarDate.of('2026-01-02');
    const saturday = CalendarDate.of('2026-01-03');
    const sunday = CalendarDate.of('2026-01-04');

    expect(friday.isBefore(saturday)).toBe(true);
    expect(saturday.isAfter(friday)).toBe(true);
    expect(friday.isOnOrBefore(friday)).toBe(true);
    expect(friday.isOnOrBefore(saturday)).toBe(true);
    expect(saturday.isOnOrAfter(friday)).toBe(true);
    expect(saturday.isOnOrAfter(saturday)).toBe(true);
    expect(friday.isWeekend()).toBe(false);
    expect(saturday.isWeekend()).toBe(true);
    expect(sunday.isWeekend()).toBe(true);
    expect(friday.equals(CalendarDate.of('2026-01-02'))).toBe(true);
  });
});
