import { Injectable } from '@nestjs/common';
import { QueryHandler } from '@investflow/shared-application';
import {
  BusinessDayCalendar,
  CalendarDate,
  CalendarDateRange,
  InvalidCalendarDateRangeError,
  Result,
} from '@investflow/shared-domain';

export interface GetBusinessCalendarQuery {
  readonly fromYear: number;
  readonly toYear: number;
}

export interface GetBusinessCalendarOutput {
  readonly fromYear: number;
  readonly toYear: number;
  // Holidays on weekdays, in order; weekends are never business days.
  readonly holidays: readonly string[];
}

@Injectable()
export class GetBusinessCalendarQueryHandler
  implements QueryHandler<GetBusinessCalendarQuery, GetBusinessCalendarOutput>
{
  // Every browser asks for the same years until the year changes, so the
  // last answer is kept.
  private cached: GetBusinessCalendarOutput | null = null;

  execute({
    fromYear,
    toYear,
  }: GetBusinessCalendarQuery): Promise<
    Result<GetBusinessCalendarOutput, InvalidCalendarDateRangeError>
  > {
    if (this.cached?.fromYear === fromYear && this.cached.toYear === toYear) {
      return Promise.resolve(Result.ok(this.cached));
    }
    const pad = (year: number) => String(year).padStart(4, '0');
    const range = CalendarDateRange.create(
      CalendarDate.of(`${pad(fromYear)}-01-01`),
      CalendarDate.of(`${pad(toYear)}-12-31`),
    );
    if (range.isErr()) return Promise.resolve(range);
    this.cached = {
      fromYear,
      toYear,
      holidays: BusinessDayCalendar.weekdayHolidaysIn(range.value).map((date) =>
        date.toIsoString(),
      ),
    };
    return Promise.resolve(Result.ok(this.cached));
  }
}
