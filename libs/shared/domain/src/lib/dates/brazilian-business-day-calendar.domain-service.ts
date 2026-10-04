import { CalendarDate } from './calendar-date.vo';
import { BusinessDayCalendar } from './business-day-calendar.domain-service';
import { calculateGregorianEasterSunday } from './gregorian-easter';

const FIXED_HOLIDAYS = new Set([
  '01-01',
  '04-21',
  '05-01',
  '09-07',
  '10-12',
  '11-02',
  '11-15',
  '11-20',
  '12-25',
]);

const MOVABLE_HOLIDAY_OFFSETS_FROM_EASTER = {
  carnivalMonday: -48,
  carnivalTuesday: -47,
  goodFriday: -2,
  corpusChristi: 60,
} as const;

export class BrazilianBusinessDayCalendar extends BusinessDayCalendar {
  override isBusinessDay(date: CalendarDate): boolean {
    return super.isBusinessDay(date) && !isBrazilianHoliday(date);
  }
}

function isBrazilianHoliday(date: CalendarDate): boolean {
  const isoDate = date.toIsoString();
  if (FIXED_HOLIDAYS.has(isoDate.slice(5))) return true;

  const year = Number(isoDate.slice(0, 4));
  const easterSunday = calculateGregorianEasterSunday(year);

  return Object.values(MOVABLE_HOLIDAY_OFFSETS_FROM_EASTER).some((offset) =>
    easterSunday.addDays(offset).equals(date),
  );
}
