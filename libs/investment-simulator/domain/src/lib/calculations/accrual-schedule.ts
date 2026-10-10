import {
  BusinessDayCalendar,
  CalendarDate,
  Result,
} from '@investflow/shared-domain';
import { InvestmentCalculationError } from './investment-calculation.error';

// The rate of one business day remunerates until the next business day, where
// the resulting balance is presented.
export interface AccrualPeriod {
  readonly rateReferenceDate: CalendarDate;
  readonly balanceDate: CalendarDate;
}

// Expects investmentDate before maturityDate, as InvestmentScenario guarantees.
export function accrualPeriodsBetween(
  calendar: BusinessDayCalendar,
  investmentDate: CalendarDate,
  maturityDate: CalendarDate,
): Result<AccrualPeriod[], InvestmentCalculationError> {
  if (!calendar.isBusinessDay(investmentDate)) {
    return Result.err(
      InvestmentCalculationError.notBusinessDay(
        'investmentDate',
        investmentDate,
      ),
    );
  }
  if (!calendar.isBusinessDay(maturityDate)) {
    return Result.err(
      InvestmentCalculationError.notBusinessDay('maturityDate', maturityDate),
    );
  }

  const periods: AccrualPeriod[] = [];
  let rateReferenceDate = investmentDate;
  for (
    let date = investmentDate.addDays(1);
    !date.isAfter(maturityDate);
    date = date.addDays(1)
  ) {
    if (!calendar.isBusinessDay(date)) continue;
    periods.push({ rateReferenceDate, balanceDate: date });
    rateReferenceDate = date;
  }
  return Result.ok(periods);
}
