import {
  BrazilianBusinessDayCalendar,
  CalendarDate,
} from '@investflow/shared-domain';
import { accrualPeriodsBetween } from './accrual-schedule';

const calendar = new BrazilianBusinessDayCalendar();

function periods(start: string, end: string) {
  return accrualPeriodsBetween(
    calendar,
    CalendarDate.of(start),
    CalendarDate.of(end),
  );
}

function pairs(start: string, end: string) {
  return periods(start, end).value.map(({ rateReferenceDate, balanceDate }) => [
    rateReferenceDate.toIsoString(),
    balanceDate.toIsoString(),
  ]);
}

describe('accrualPeriodsBetween', () => {
  it('chains business days across Carnival holidays', () => {
    expect(pairs('2026-02-13', '2026-02-19')).toEqual([
      ['2026-02-13', '2026-02-18'],
      ['2026-02-18', '2026-02-19'],
    ]);
  });

  it('crosses the year boundary without accruing on New Year', () => {
    expect(pairs('2025-12-31', '2026-01-02')).toEqual([
      ['2025-12-31', '2026-01-02'],
    ]);
  });

  it('uses the investment date as the first rate reference', () => {
    expect(pairs('2026-01-02', '2026-01-05')).toEqual([
      ['2026-01-02', '2026-01-05'],
    ]);
  });

  it.each([
    ['2026-01-03', '2026-01-06', 'investmentDate'],
    ['2026-01-02', '2026-01-04', 'maturityDate'],
    ['2026-04-03', '2026-04-06', 'investmentDate'],
    ['2026-04-02', '2026-04-03', 'maturityDate'],
  ])('rejects non-business dates %s to %s', (start, end, field) => {
    const error = periods(start, end).error;
    expect(error.code).toBe('INVESTMENT_DATE_NOT_BUSINESS_DAY');
    expect(error.metadata?.['field']).toBe(field);
  });
});
