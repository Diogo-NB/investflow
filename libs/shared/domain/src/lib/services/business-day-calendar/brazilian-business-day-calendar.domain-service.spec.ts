import { CalendarDateRange } from '../../value-objects/calendar-date-range/calendar-date-range.vo';
import { CalendarDate } from '../../value-objects/calendar-date/calendar-date.vo';
import { BrazilianBusinessDayCalendar } from './brazilian-business-day-calendar.domain-service';

describe('BrazilianBusinessDayCalendar', () => {
  const calendar = new BrazilianBusinessDayCalendar();

  it.each([
    '2026-01-01',
    '2026-04-21',
    '2026-05-01',
    '2026-09-07',
    '2026-10-12',
    '2026-11-02',
    '2026-11-15',
    '2026-11-20',
    '2026-12-25',
  ])('identifies the fixed holiday %s', (date) => {
    expect(calendar.isBusinessDay(CalendarDate.of(date))).toBe(false);
  });

  it.each([
    ['2025-03-03', 'Carnival Monday'],
    ['2025-03-04', 'Carnival Tuesday'],
    ['2025-04-18', 'Good Friday'],
    ['2025-06-19', 'Corpus Christi'],
    ['2026-02-16', 'Carnival Monday'],
    ['2026-02-17', 'Carnival Tuesday'],
    ['2026-04-03', 'Good Friday'],
    ['2026-06-04', 'Corpus Christi'],
  ])('identifies %s as %s', (date) => {
    expect(calendar.isBusinessDay(CalendarDate.of(date))).toBe(false);
  });

  it('identifies ordinary weekdays and weekends', () => {
    expect(calendar.isBusinessDay(CalendarDate.of('2026-02-18'))).toBe(true);
    expect(calendar.isBusinessDay(CalendarDate.of('2026-02-21'))).toBe(false);
    expect(calendar.isBusinessDay(CalendarDate.of('2026-02-22'))).toBe(false);
  });

  it('counts business days excluding the start and including the end', () => {
    const range = CalendarDateRange.of(
      CalendarDate.of('2026-02-13'),
      CalendarDate.of('2026-02-18'),
    );

    expect(calendar.countBusinessDays(range)).toBe(1);
  });

  it('counts across a year boundary containing New Year day', () => {
    const range = CalendarDateRange.of(
      CalendarDate.of('2025-12-31'),
      CalendarDate.of('2026-01-02'),
    );

    expect(calendar.countBusinessDays(range)).toBe(1);
  });
});
