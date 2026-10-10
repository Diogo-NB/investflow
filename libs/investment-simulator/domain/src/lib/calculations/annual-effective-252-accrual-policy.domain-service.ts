import { Rate } from '@investflow/shared-domain';
import Decimal from 'decimal.js';

const BUSINESS_DAYS_PER_YEAR = 252;

export class AnnualEffective252AccrualPolicy {
  dailyFactor(annualRate: Decimal): Decimal {
    return annualRate.plus(1).pow(new Decimal(1).div(BUSINESS_DAYS_PER_YEAR));
  }

  percentageDailyFactor(
    annualIndexRate: Decimal,
    contractedPercentage: Rate,
  ): Decimal {
    const dailyIndexRate = this.dailyFactor(annualIndexRate).minus(1);
    return dailyIndexRate.times(contractedPercentage.value).plus(1);
  }
}
