import {
  formatInstant,
  formatMonth,
  formatIsoDate,
  isIsoDate,
  isoToLocalDate,
  localDateToIso,
  parseBrazilianDate,
  previousDay,
  todayInSaoPaulo,
} from './calendar-date';

describe('calendar dates', () => {
  it('parses only real Brazilian dates', () => {
    expect(parseBrazilianDate('31/12/2028')).toBe('2028-12-31');
    expect(parseBrazilianDate(' 29/02/2028 ')).toBe('2028-02-29');
    for (const text of ['29/02/2027', '31/04/2026', '1/1/2026', '2026-01-01']) {
      expect(parseBrazilianDate(text)).toBeNull();
    }
  });

  it('validates and formats ISO calendar strings', () => {
    expect(isIsoDate('2026-01-02')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('02/01/2026')).toBe(false);
    expect(formatIsoDate('2026-01-02')).toBe('02/01/2026');
    expect(formatMonth('2026-03')).toBe('março de 2026');
    expect(formatMonth('2027-12')).toBe('dezembro de 2027');
  });

  it('reads today and instants in São Paulo time', () => {
    // 02:00 UTC is still the previous evening in São Paulo (UTC-3).
    const instant = new Date('2026-03-02T02:00:00Z');
    expect(todayInSaoPaulo(instant)).toBe('2026-03-01');
    expect(formatInstant('2026-03-02T02:00:00Z')).toBe('01/03/2026, 23:00');
  });

  it('steps back across month, year and leap boundaries', () => {
    expect(previousDay('2026-03-02')).toBe('2026-03-01');
    expect(previousDay('2028-03-01')).toBe('2028-02-29');
    expect(previousDay('2026-01-01')).toBe('2025-12-31');
  });

  it('round trips the widget date without touching UTC', () => {
    expect(localDateToIso(isoToLocalDate('2026-12-31'))).toBe('2026-12-31');
  });
});
