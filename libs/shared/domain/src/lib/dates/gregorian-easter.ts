import { CalendarDate } from './calendar-date.vo';

/**
 * Calculates Easter Sunday using the Gregorian algorithm published in
 * Jean Meeus, Astronomical Algorithms, 2nd ed., chapter 8.
 */
export function calculateGregorianEasterSunday(year: number): CalendarDate {
  // Variables a–m intentionally match Meeus's published notation so the
  // implementation can be verified line-by-line against the reference.
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return CalendarDate.of(
    `${year.toString().padStart(4, '0')}-${month
      .toString()
      .padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
  );
}
