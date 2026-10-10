import { CalendarDateRange } from './calendar-date-range.vo';
import { CalendarDate } from './calendar-date.vo';

export class BusinessDayCalendar {
  // Excludes the start date and includes the end date.
  countBusinessDays(range: CalendarDateRange): number {
    let count = 0;
    range.forEachDayIn((date) => {
      if (!date.equals(range.start) && this.isBusinessDay(date)) count += 1;
    });
    return count;
  }

  isBusinessDay(date: CalendarDate): boolean {
    return !date.isWeekend();
  }
}
