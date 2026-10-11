import { Money, Rate } from '@investflow/shared-domain';

// Decreto nº 6.306/2007, art. 32 and Anexo: a regressive share of the earnings
// per calendar day held; from the 30th day on, no IOF is due.
export const IOF_EXEMPT_FROM_CALENDAR_DAYS = 30;

export interface IofDailyRate {
  readonly calendarDay: number;
  readonly rate: Rate;
}

/** IOF share of the earnings for each calendar day held, days 1 to 29. */
export const IOF_DAILY_RATES: readonly IofDailyRate[] = [
  '0.96',
  '0.93',
  '0.90',
  '0.86',
  '0.83',
  '0.80',
  '0.76',
  '0.73',
  '0.70',
  '0.66',
  '0.63',
  '0.60',
  '0.56',
  '0.53',
  '0.50',
  '0.46',
  '0.43',
  '0.40',
  '0.36',
  '0.33',
  '0.30',
  '0.26',
  '0.23',
  '0.20',
  '0.16',
  '0.13',
  '0.10',
  '0.06',
  '0.03',
].map((rate, index) => ({ calendarDay: index + 1, rate: Rate.of(rate) }));

export class IofPolicy {
  /** The share of the earnings due, or null once the holding is exempt. */
  rateForHoldingPeriod(holdingPeriodCalendarDays: number): Rate | null {
    return holdingPeriodCalendarDays >= IOF_EXEMPT_FROM_CALENDAR_DAYS
      ? null
      : IOF_DAILY_RATES[holdingPeriodCalendarDays - 1].rate;
  }

  taxOnEarnings(earnings: Money, holdingPeriodCalendarDays: number): Money {
    const rate = this.rateForHoldingPeriod(holdingPeriodCalendarDays);
    if (!rate || !earnings.isPositive()) return Money.zero(earnings.currency);
    return earnings.times(rate.value);
  }
}
