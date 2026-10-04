import { CalendarDateRange } from './calendar-date-range.vo';
import { CalendarDate } from './calendar-date.vo';

export class BusinessDayCalendar {
  countBusinessDays(range: CalendarDateRange): number {
    let current = range.start.addDays(1);
    let count = 0;

    while (!current.isAfter(range.end)) {
      if (this.isBusinessDay(current)) count += 1;
      current = current.addDays(1);
    }

    return count;
  }

  isBusinessDay(date: CalendarDate): boolean {
    return !date.isWeekend();
  }
}
