import {
  acceptedYears,
  businessCalendar,
  isInAcceptedYears,
  outsideAcceptedYearsMessage,
} from './business-calendar';

// 2026-10-12 is a Monday holiday; the window is 1926 to 2126.
const calendar = businessCalendar({
  fromYear: 1926,
  toYear: 2126,
  holidays: ['2026-10-12', '2026-12-25', '2027-01-01'],
});

describe('businessCalendar', () => {
  it('treats weekends and holidays as non-business days', () => {
    expect(calendar.isBusinessDay('2026-10-09')).toBe(true);
    expect(calendar.isBusinessDay('2026-10-10')).toBe(false);
    expect(calendar.isBusinessDay('2026-10-11')).toBe(false);
    expect(calendar.isBusinessDay('2026-10-12')).toBe(false);
    expect(calendar.isBusinessDay('1926-01-05')).toBe(true);
  });

  it('skips weekends and holidays in both directions, across years', () => {
    expect(calendar.nextBusinessDay('2026-10-09')).toBe('2026-10-13');
    expect(calendar.previousBusinessDay('2026-10-13')).toBe('2026-10-09');
    expect(calendar.nextBusinessDay('2026-12-31')).toBe('2027-01-04');
  });

  it('knows its window and finds nothing past it', () => {
    expect([calendar.first, calendar.last]).toEqual([
      '1926-01-01',
      '2126-12-31',
    ]);
    expect(calendar.contains('1925-12-31')).toBe(false);
    expect(calendar.contains('2126-12-31')).toBe(true);
    // Nothing after 2126-12-31, a Tuesday, is in the window.
    expect(calendar.nextBusinessDay('2126-12-31')).toBeNull();
    expect(calendar.previousBusinessDay('1926-01-01')).toBeNull();
  });

  it('accepts a hundred years around the current one', () => {
    expect(acceptedYears('2026-10-14')).toEqual({
      fromYear: 1926,
      toYear: 2126,
    });
    expect(isInAcceptedYears('1926-01-01', '2026-10-14')).toBe(true);
    expect(isInAcceptedYears('2126-12-31', '2026-10-14')).toBe(true);
    expect(isInAcceptedYears('1925-12-31', '2026-10-14')).toBe(false);
    expect(isInAcceptedYears('2127-01-01', '2026-10-14')).toBe(false);
    expect(outsideAcceptedYearsMessage('2027-01-01')).toBe(
      'Use datas entre 01/01/1927 e 31/12/2127.',
    );
  });
});
