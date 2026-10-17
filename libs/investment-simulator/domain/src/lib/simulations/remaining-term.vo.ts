import { CalendarDate, ValueObject } from '@investflow/shared-domain';

export type RemainingTermPhase = 'NOT_STARTED' | 'RUNNING' | 'MATURED';

export interface RemainingTermProps {
  readonly phase: RemainingTermPhase;
  // Calendar days until maturity, zero on the maturity date and once matured.
  readonly calendarDays: number;
  readonly years: number;
  readonly months: number;
  readonly days: number;
}

export class RemainingTerm extends ValueObject<RemainingTerm> {
  private constructor(private readonly props: RemainingTermProps) {
    super();
  }

  // Counted from the investment date while it is in the future, so it never
  // exceeds the whole term. Null when maturity precedes the investment date,
  // which leaves the simulation without a term until it is fixed.
  static at(
    today: CalendarDate,
    investmentDate: CalendarDate,
    maturityDate: CalendarDate,
  ): RemainingTerm | null {
    if (today.isAfter(maturityDate)) {
      return new RemainingTerm({
        phase: 'MATURED',
        calendarDays: 0,
        years: 0,
        months: 0,
        days: 0,
      });
    }
    if (maturityDate.isBefore(investmentDate)) return null;
    const notStarted = today.isBefore(investmentDate);
    const start = notStarted ? investmentDate : today;
    return new RemainingTerm({
      phase: notStarted ? 'NOT_STARTED' : 'RUNNING',
      calendarDays: start.daysUntil(maturityDate),
      ...RemainingTerm.split(start, maturityDate),
    });
  }

  // Whole years, then whole months, then days, adding calendar months as the
  // LCI and LCA minimum term does: 31/01 to 28/02 is one month. Months are
  // always added to the start itself, since chaining clamped dates would drift.
  private static split(
    start: CalendarDate,
    end: CalendarDate,
  ): Pick<RemainingTermProps, 'years' | 'months' | 'days'> {
    let totalMonths =
      (end.year - start.year) * 12 + (end.month - start.month);
    while (totalMonths > 0 && start.addMonths(totalMonths).isAfter(end)) {
      totalMonths -= 1;
    }
    return {
      years: Math.floor(totalMonths / 12),
      months: totalMonths % 12,
      days: start.addMonths(totalMonths).daysUntil(end),
    };
  }

  get phase(): RemainingTermPhase {
    return this.props.phase;
  }

  get calendarDays(): number {
    return this.props.calendarDays;
  }

  get years(): number {
    return this.props.years;
  }

  get months(): number {
    return this.props.months;
  }

  get days(): number {
    return this.props.days;
  }

  equals(other: RemainingTerm): boolean {
    return (
      this.phase === other.phase &&
      this.calendarDays === other.calendarDays &&
      this.years === other.years &&
      this.months === other.months &&
      this.days === other.days
    );
  }
}
