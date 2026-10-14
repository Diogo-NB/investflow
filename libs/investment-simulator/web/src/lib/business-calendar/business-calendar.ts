import {
  dayNumber,
  formatIsoDate,
  nextDay,
  previousDay,
} from '../dates/calendar-date';
import type { BusinessCalendarData } from './business-calendar-api';

export interface AcceptedYears {
  readonly fromYear: number;
  readonly toYear: number;
}

/**
 * The years the page accepts dates in. Its calendars and date checks cannot
 * cover every year, so this is a limit of the page alone: the API takes any
 * date.
 */
export function acceptedYears(today: string): AcceptedYears {
  const year = Number(today.slice(0, 4));
  return { fromYear: year - 100, toYear: year + 100 };
}

const pad = (year: number) => String(year).padStart(4, '0');

export function isInAcceptedYears(isoDate: string, today: string): boolean {
  const { fromYear, toYear } = acceptedYears(today);
  return (
    isoDate >= `${pad(fromYear)}-01-01` && isoDate <= `${pad(toYear)}-12-31`
  );
}

export function outsideAcceptedYearsMessage(today: string): string {
  const { fromYear, toYear } = acceptedYears(today);
  return `Use datas entre ${formatIsoDate(`${pad(fromYear)}-01-01`)} e ${formatIsoDate(`${pad(toYear)}-12-31`)}.`;
}

export interface BusinessCalendar {
  // The first and last dates of the years the calendar covers.
  readonly first: string;
  readonly last: string;
  contains(isoDate: string): boolean;
  isBusinessDay(isoDate: string): boolean;
  // The first business day after, or before, a date; null past the window.
  nextBusinessDay(isoDate: string): string | null;
  previousBusinessDay(isoDate: string): string | null;
}

export function businessCalendar({
  fromYear,
  toYear,
  holidays,
}: BusinessCalendarData): BusinessCalendar {
  const first = `${pad(fromYear)}-01-01`;
  const last = `${pad(toYear)}-12-31`;
  const holidaySet = new Set(holidays);
  const contains = (isoDate: string) => isoDate >= first && isoDate <= last;
  const isBusinessDay = (isoDate: string) => {
    // 1970-01-01 was a Thursday, so 0 is a Sunday and 6 a Saturday.
    const weekday = (((dayNumber(isoDate) + 4) % 7) + 7) % 7;
    return weekday !== 0 && weekday !== 6 && !holidaySet.has(isoDate);
  };
  const search = (isoDate: string, step: (iso: string) => string) => {
    let date = step(isoDate);
    while (contains(date)) {
      if (isBusinessDay(date)) return date;
      date = step(date);
    }
    return null;
  };
  return {
    first,
    last,
    contains,
    isBusinessDay,
    nextBusinessDay: (isoDate) => search(isoDate, nextDay),
    previousBusinessDay: (isoDate) => search(isoDate, previousDay),
  };
}
