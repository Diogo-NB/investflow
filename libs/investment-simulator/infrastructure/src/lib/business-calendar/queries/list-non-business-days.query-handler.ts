import { Injectable } from '@nestjs/common';
import { QueryHandler } from '@investflow/shared-application';
import {
  BusinessDayCalendar,
  CalendarDate,
  CalendarDateRange,
  Result,
} from '@investflow/shared-domain';

export interface ListNonBusinessDaysQuery {
  readonly year: number;
}

export interface ListNonBusinessDaysOutput {
  readonly year: number;
  // Weekends and national holidays, in order.
  readonly dates: readonly string[];
}

@Injectable()
export class ListNonBusinessDaysQueryHandler
  implements QueryHandler<ListNonBusinessDaysQuery, ListNonBusinessDaysOutput>
{
  constructor(private readonly calendar: BusinessDayCalendar) {}

  execute({
    year,
  }: ListNonBusinessDaysQuery): Promise<
    Result<ListNonBusinessDaysOutput, never>
  > {
    const pad = String(year).padStart(4, '0');
    const range = CalendarDateRange.of(
      CalendarDate.of(`${pad}-01-01`),
      CalendarDate.of(`${pad}-12-31`),
    );
    return Promise.resolve(
      Result.ok({
        year,
        dates: this.calendar
          .nonBusinessDaysIn(range)
          .map((date) => date.toIsoString()),
      }),
    );
  }
}
