import Decimal from 'decimal.js';

const BUSINESS_DAYS_PER_YEAR = 252;

// Converts an annual effective rate (base 252) to its daily equivalent and
// earns the contracted percentage of it: 1 + ((1 + annual)^(1/252) - 1) * pct.
export function dailyAccrualFactor(
  annualRate: Decimal,
  percentage: Decimal,
): Decimal {
  const dailyRate = annualRate
    .plus(1)
    .pow(new Decimal(1).div(BUSINESS_DAYS_PER_YEAR))
    .minus(1);
  return dailyRate.times(percentage).plus(1);
}
