import { CalendarDateRange } from './calendar-date-range.vo';
import { CalendarDate } from './calendar-date.vo';
import { BusinessDayCalendar } from './business-day-calendar.domain-service';

describe('BusinessDayCalendar', () => {
  it('identifies weekdays and weekends', () => {
    expect(
      BusinessDayCalendar.isBusinessDay(CalendarDate.of('2026-01-05')),
    ).toBe(true);
    expect(
      BusinessDayCalendar.isBusinessDay(CalendarDate.of('2026-01-10')),
    ).toBe(false);
    expect(
      BusinessDayCalendar.isBusinessDay(CalendarDate.of('2026-01-11')),
    ).toBe(false);
  });

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
    expect(BusinessDayCalendar.isBusinessDay(CalendarDate.of(date))).toBe(
      false,
    );
  });

  it.each([
    ['2023-11-20', 'Consciência Negra before Lei 14.759/2023'],
    ['1979-10-12', 'Nossa Senhora Aparecida before Lei 6.802/1980'],
  ])('treats %s as a business day: %s', (date) => {
    expect(BusinessDayCalendar.isBusinessDay(CalendarDate.of(date))).toBe(true);
  });

  it('lists only the holidays that fall on weekdays', () => {
    const days = BusinessDayCalendar.weekdayHolidaysIn(
      CalendarDateRange.of(
        CalendarDate.of('2026-11-01'),
        CalendarDate.of('2026-11-30'),
      ),
    );
    // 11-15 is a Sunday.
    expect(days.map((date) => date.toIsoString())).toEqual([
      '2026-11-02',
      '2026-11-20',
    ]);
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
    expect(BusinessDayCalendar.isBusinessDay(CalendarDate.of(date))).toBe(
      false,
    );
  });

  it('identifies ordinary weekdays and weekends', () => {
    expect(
      BusinessDayCalendar.isBusinessDay(CalendarDate.of('2026-02-18')),
    ).toBe(true);
    expect(
      BusinessDayCalendar.isBusinessDay(CalendarDate.of('2026-02-21')),
    ).toBe(false);
    expect(
      BusinessDayCalendar.isBusinessDay(CalendarDate.of('2026-02-22')),
    ).toBe(false);
  });
});
