import { CalendarDate } from '@investflow/shared-domain';
import { RemainingTerm } from '../remaining-term.vo';

const term = (today: string, investment: string, maturity: string) =>
  RemainingTerm.at(
    CalendarDate.of(today),
    CalendarDate.of(investment),
    CalendarDate.of(maturity),
  );

const parts = (value: RemainingTerm | null) =>
  value && {
    phase: value.phase,
    calendarDays: value.calendarDays,
    years: value.years,
    months: value.months,
    days: value.days,
  };

describe('RemainingTerm value object', () => {
  it('counts from today while the investment runs', () => {
    expect(parts(term('2026-10-16', '2026-01-02', '2028-10-14'))).toEqual({
      phase: 'RUNNING',
      calendarDays: 729,
      years: 1,
      months: 11,
      days: 28,
    });
  });

  it('counts the whole term from a future investment date', () => {
    expect(parts(term('2026-10-16', '2026-11-03', '2028-11-03'))).toEqual({
      phase: 'NOT_STARTED',
      calendarDays: 731,
      years: 2,
      months: 0,
      days: 0,
    });
  });

  it('is zero on the maturity date', () => {
    expect(parts(term('2028-10-14', '2026-01-02', '2028-10-14'))).toEqual({
      phase: 'RUNNING',
      calendarDays: 0,
      years: 0,
      months: 0,
      days: 0,
    });
  });

  it('has no term left once matured', () => {
    expect(term('2028-10-15', '2026-01-02', '2028-10-14')?.phase).toBe(
      'MATURED',
    );
    expect(term('2028-10-15', '2026-01-02', '2028-10-14')?.calendarDays).toBe(
      0,
    );
  });

  it('adds calendar months clamped to the end of the month', () => {
    expect(parts(term('2027-01-31', '2026-01-02', '2027-02-28'))).toMatchObject(
      { years: 0, months: 1, days: 0 },
    );
    expect(parts(term('2028-01-31', '2026-01-02', '2028-02-28'))).toMatchObject(
      { years: 0, months: 0, days: 28 },
    );
    expect(parts(term('2028-01-31', '2026-01-02', '2028-02-29'))).toMatchObject(
      { years: 0, months: 1, days: 0 },
    );
    expect(parts(term('2027-03-31', '2026-01-02', '2027-05-30'))).toMatchObject(
      { years: 0, months: 1, days: 30 },
    );
  });

  it('counts whole years across a leap day', () => {
    expect(parts(term('2028-02-29', '2026-01-02', '2029-02-28'))).toMatchObject(
      { years: 1, months: 0, days: 0 },
    );
  });

  it('has no term when maturity precedes the investment date', () => {
    expect(term('2026-10-16', '2027-01-04', '2026-12-01')).toBeNull();
  });
});
