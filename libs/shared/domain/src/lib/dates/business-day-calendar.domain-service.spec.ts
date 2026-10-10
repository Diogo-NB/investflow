import { CalendarDateRange } from './calendar-date-range.vo';
import { CalendarDate } from './calendar-date.vo';
import { BusinessDayCalendar } from './business-day-calendar.domain-service';

describe('BusinessDayCalendar', () => {
  const calendar = new BusinessDayCalendar();

  it('counts business days excluding the start date and including the end date', () => {
    const range = CalendarDateRange.of(
      CalendarDate.of('2026-01-02'),
      CalendarDate.of('2026-01-09'),
    );

    expect(calendar.countBusinessDays(range)).toBe(5);
  });

  it('ignores Saturdays and Sundays', () => {
    const range = CalendarDateRange.of(
      CalendarDate.of('2026-01-02'),
      CalendarDate.of('2026-01-05'),
    );

    expect(calendar.countBusinessDays(range)).toBe(1);
  });

  it('excludes the start date, so a one-day range counts nothing', () => {
    const day = CalendarDate.of('2026-01-05');

    expect(calendar.countBusinessDays(CalendarDateRange.of(day, day))).toBe(0);
  });

  it('identifies weekdays and weekends', () => {
    expect(calendar.isBusinessDay(CalendarDate.of('2026-01-05'))).toBe(true);
    expect(calendar.isBusinessDay(CalendarDate.of('2026-01-10'))).toBe(false);
    expect(calendar.isBusinessDay(CalendarDate.of('2026-01-11'))).toBe(false);
  });

  it('counts across month and year boundaries', () => {
    const range = CalendarDateRange.of(
      CalendarDate.of('2025-12-31'),
      CalendarDate.of('2026-01-02'),
    );

    expect(calendar.countBusinessDays(range)).toBe(2);
  });
});
