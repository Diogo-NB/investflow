import {
  BusinessDayCalendar,
  CalendarDate,
  CalendarDateRange,
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

  // Each business day closes the period opened by the previous one; the
  // investment date only opens the first period.
  const businessDays = CalendarDateRange.of(
    investmentDate,
    maturityDate,
  ).datesBetween.filter((date) => calendar.isBusinessDay(date));
  return Result.ok(
    businessDays.slice(1).map((balanceDate, index) => ({
      rateReferenceDate: businessDays[index],
      balanceDate,
    })),
  );
}
