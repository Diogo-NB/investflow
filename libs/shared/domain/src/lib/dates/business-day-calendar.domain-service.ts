import { CalendarDateRange } from './calendar-date-range.vo';
import { CalendarDate } from './calendar-date.vo';

export class BusinessDayCalendar {
  // Excludes the start date and includes the end date.
  countBusinessDays(range: CalendarDateRange): number {
    return range.datesBetween
      .slice(1)
      .filter((date) => this.isBusinessDay(date)).length;
  }

  isBusinessDay(date: CalendarDate): boolean {
    return !date.isWeekend();
  }
}
