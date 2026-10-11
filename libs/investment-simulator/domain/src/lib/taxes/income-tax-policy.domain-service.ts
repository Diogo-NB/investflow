import { Rate } from '@investflow/shared-domain';

export interface IncomeTaxBracket {
  // Inclusive bounds in calendar days; null for the open last bracket.
  readonly fromCalendarDays: number;
  readonly upToCalendarDays: number | null;
  readonly rate: Rate;
}

// Instrução Normativa RFB nº 1.585/2015, art. 46: regressive rates by the
// calendar days the investment was held.
export const INCOME_TAX_BRACKETS: readonly IncomeTaxBracket[] = [
  { fromCalendarDays: 1, upToCalendarDays: 180, rate: Rate.of('0.225') },
  { fromCalendarDays: 181, upToCalendarDays: 360, rate: Rate.of('0.20') },
  { fromCalendarDays: 361, upToCalendarDays: 720, rate: Rate.of('0.175') },
  { fromCalendarDays: 721, upToCalendarDays: null, rate: Rate.of('0.15') },
];

export class IncomeTaxPolicy {
  rateForHoldingPeriod(calendarDays: number): Rate {
    const bracket = INCOME_TAX_BRACKETS.find(
      ({ upToCalendarDays }) =>
        upToCalendarDays === null || calendarDays <= upToCalendarDays,
    );
    // The last bracket is open, so one always matches.
    return (bracket ?? INCOME_TAX_BRACKETS[INCOME_TAX_BRACKETS.length - 1])
      .rate;
  }
}
