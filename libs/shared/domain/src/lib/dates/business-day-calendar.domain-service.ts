import { CalendarDateRange } from './calendar-date-range.vo';
import { CalendarDate } from './calendar-date.vo';

export class BusinessDayCalendar {
  // Excludes the start date and includes the end date.
  countBusinessDays(range: CalendarDateRange): number {
    return range.datesBetween
      .slice(1)
      .filter((date) => this.isBusinessDay(date)).length;
  }

  // Both endpoints included.
  nonBusinessDaysIn(range: CalendarDateRange): CalendarDate[] {
    return range.datesBetween.filter((date) => !this.isBusinessDay(date));
  }

  isBusinessDay(date: CalendarDate): boolean {
    return !date.isWeekend();
  }
}
