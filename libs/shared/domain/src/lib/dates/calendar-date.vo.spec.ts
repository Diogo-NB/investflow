import { CalendarDate, InvalidCalendarDateError } from './calendar-date.vo';
import { UtcInstant } from './utc-instant.vo';

describe('CalendarDate', () => {
  describe('create', () => {
    it.each(['2026-1-02', '2026-01-2', '01-02-2026', 'not-a-date'])(
      'rejects malformed value %s',
      (value) => {
        const result = CalendarDate.create(value);

        expect(result.isErr()).toBe(true);
        expect(result.error).toBeInstanceOf(InvalidCalendarDateError);
        expect(result.error.code).toBe('INVALID_CALENDAR_DATE');
      },
    );

    it.each(['0000-01-01', '2026-02-29', '2026-04-31'])(
      'rejects invalid calendar date %s',
      (value) => {
        expect(CalendarDate.create(value).isErr()).toBe(true);
      },
    );

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
