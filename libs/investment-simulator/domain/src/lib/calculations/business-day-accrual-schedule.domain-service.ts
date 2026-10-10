import {
  BusinessDayCalendar,
  CalendarDate,
  Result,
} from '@investflow/shared-domain';
import { InvestmentCalculationError } from './investment-calculation.error';

export class BusinessDayAccrualSchedule {
  constructor(private readonly calendar: BusinessDayCalendar) {}

  create(
    investmentDate: CalendarDate,
    maturityDate: CalendarDate,
  ): Result<readonly CalendarDate[], InvestmentCalculationError> {
    if (!investmentDate.isBefore(maturityDate)) {
      return Result.err(
        new InvestmentCalculationError(
          'INVESTMENT_PERIOD_INVALID',
          'investment date must precede maturity',
        ),
      );
    }
    return Result.fromThrowable(
      () => this.createForBusinessDates(investmentDate, maturityDate),
      (cause) =>
        new InvestmentCalculationError(
          'INVESTMENT_CALCULATION_FAILED',
          'business-day accrual schedule could not be determined',
          undefined,
          cause,
        ),
    ).andThen((schedule) => schedule);
  }

  private createForBusinessDates(
    investmentDate: CalendarDate,
    maturityDate: CalendarDate,
  ): Result<readonly CalendarDate[], InvestmentCalculationError> {
    for (const [field, date] of [
      ['investmentDate', investmentDate],
      ['maturityDate', maturityDate],
    ] as const) {
      if (!this.calendar.isBusinessDay(date)) {
        return Result.err(
          new InvestmentCalculationError(
            'INVESTMENT_DATE_NOT_BUSINESS_DAY',
            'investment and maturity dates must be business days',
            { field, date: date.toIsoString() },
          ),
        );
      }
    }
    const businessDates: CalendarDate[] = [investmentDate];
    let current = investmentDate;
    while (current.isBefore(maturityDate)) {
      current = current.addDays(1);
      if (!this.calendar.isBusinessDay(current)) continue;
      businessDates.push(current);
    }
    return Result.ok(businessDates);
  }
}
