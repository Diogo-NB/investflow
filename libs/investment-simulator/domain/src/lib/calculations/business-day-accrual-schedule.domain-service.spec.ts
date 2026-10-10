import {
  BrazilianBusinessDayCalendar,
  CalendarDate,
} from '@investflow/shared-domain';
import { BusinessDayAccrualSchedule } from './business-day-accrual-schedule.domain-service';

const schedule = new BusinessDayAccrualSchedule(
  new BrazilianBusinessDayCalendar(),
);

describe('BusinessDayAccrualSchedule', () => {
  it('lists business dates across Carnival holidays', () => {
    const dates = schedule.create(
      CalendarDate.of('2026-02-13'),
      CalendarDate.of('2026-02-19'),
    ).value;
    expect(dates.map((date) => date.toIsoString())).toEqual([
      '2026-02-13',
      '2026-02-18',
      '2026-02-19',
    ]);
  });

  it('crosses the year boundary without accruing on New Year', () => {
    const dates = schedule.create(
      CalendarDate.of('2025-12-31'),
      CalendarDate.of('2026-01-02'),
    ).value;
    expect(dates.map((date) => date.toIsoString())).toEqual([
      '2025-12-31',
      '2026-01-02',
    ]);
  });

  it('includes both the investment anchor and maturity for a single accrual step', () => {
    const dates = schedule.create(
      CalendarDate.of('2026-01-02'),
      CalendarDate.of('2026-01-05'),
    ).value;
    expect(dates.map((date) => date.toIsoString())).toEqual([
      '2026-01-02',
      '2026-01-05',
    ]);
  });
});
