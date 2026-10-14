import { CalendarDateRange } from './calendar-date-range.vo';
import { CalendarDate } from './calendar-date.vo';
import { calculateGregorianEasterSunday } from './gregorian-easter';

// Month-day of each fixed holiday and the first year it applies; 0 when it
// applies to every year because its start was not researched.
const FIXED_HOLIDAYS = new Map([
  ['01-01', 0],
  ['04-21', 0],
  ['05-01', 0],
  ['09-07', 0],
  // Lei 6.802/1980.
  ['10-12', 1980],
  ['11-02', 0],
  ['11-15', 0],
  // Lei 14.759/2023.
  ['11-20', 2024],
  ['12-25', 0],
]);

const MOVABLE_HOLIDAY_OFFSETS_FROM_EASTER = {
  carnivalMonday: -48,
  carnivalTuesday: -47,
  goodFriday: -2,
  corpusChristi: 60,
} as const;

/**
 * Brazil's national financial calendar. Its rules are fixed in code, so it is
 * used statically; a calendar loaded from data (an ANBIMA import) would have
 * to become an instance passed to the code that needs it.
 */
export abstract class BusinessDayCalendar {
  static isBusinessDay(date: CalendarDate): boolean {
    return !date.isWeekend && !BusinessDayCalendar.isBrazilianHoliday(date);
  }

  // Holidays that fall on weekdays, both endpoints included; with weekends
  // they are every non-business day.
  static weekdayHolidaysIn(range: CalendarDateRange): CalendarDate[] {
    return range.datesBetween.filter(
      (date) => !date.isWeekend && BusinessDayCalendar.isBrazilianHoliday(date),
    );
  }

  private static isBrazilianHoliday(date: CalendarDate): boolean {
    const isoDate = date.toIsoString();
    const year = Number(isoDate.slice(0, 4));
    const since = FIXED_HOLIDAYS.get(isoDate.slice(5));
    if (since !== undefined && year >= since) return true;

    const easterSunday = calculateGregorianEasterSunday(year);

    return Object.values(MOVABLE_HOLIDAY_OFFSETS_FROM_EASTER).some((offset) =>
      easterSunday.addDays(offset).equals(date),
    );
  }
}
