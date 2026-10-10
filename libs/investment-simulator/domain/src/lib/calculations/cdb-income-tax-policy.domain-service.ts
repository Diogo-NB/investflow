import { Rate } from '@investflow/shared-domain';

const HOLDING_PERIOD_BRACKETS = [
  { upToCalendarDays: 180, rate: Rate.of('0.225') },
  { upToCalendarDays: 360, rate: Rate.of('0.20') },
  { upToCalendarDays: 720, rate: Rate.of('0.175') },
] as const;

const LONG_TERM_RATE = Rate.of('0.15');

export class CdbIncomeTaxPolicy {
  rateForHoldingPeriod(calendarDays: number): Rate {
    const bracket = HOLDING_PERIOD_BRACKETS.find(
      ({ upToCalendarDays }) => calendarDays <= upToCalendarDays,
    );
    return bracket?.rate ?? LONG_TERM_RATE;
  }
}
