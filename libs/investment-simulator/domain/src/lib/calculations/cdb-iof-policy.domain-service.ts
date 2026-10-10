import { Money, Rate } from '@investflow/shared-domain';

const IOF_EXEMPTION_HOLDING_DAYS = 30;
const DAILY_EARNINGS_TAX_RATES: readonly Rate[] = [
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
].map((rate) => Rate.of(rate));

export class CdbIofPolicy {
  taxOnEarnings(earnings: Money, holdingPeriodCalendarDays: number): Money {
    if (
      !earnings.isPositive() ||
      holdingPeriodCalendarDays >= IOF_EXEMPTION_HOLDING_DAYS
    ) {
      return Money.zero(earnings.currency);
    }
    const rate = DAILY_EARNINGS_TAX_RATES[holdingPeriodCalendarDays - 1];
    return earnings.times(rate.value);
  }
}
