import { BusinessDayCalendar, Money, Result } from '@investflow/shared-domain';
import Decimal from 'decimal.js';
import { TitleType } from '../offers/title-type.enum';
import { AccrualRate, resolveAccrualRates } from './accrual-rates';
import { accrualPeriodsBetween } from './accrual-schedule';
import { dailyAccrualFactor } from './annual-effective-252';
import { CdbTaxCalculator } from './cdb-tax-calculator.domain-service';
import { InvestmentCalculationError } from './investment-calculation.error';
import {
  DailyInvestmentBalance,
  InvestmentCalculation,
} from './investment-calculation.type';
import { InvestmentScenario } from './investment-scenario.vo';

// Bump whenever formulas, conventions or the business-day calendar change the
// figures, so recorded runs keep identifying what produced them.
export const METHODOLOGY_VERSION = 'cdb-252-v1';

export class InvestmentCalculator {
  private readonly cdbTaxes = new CdbTaxCalculator();

  constructor(private readonly calendar: BusinessDayCalendar) {}

  calculate(
    scenario: InvestmentScenario,
  ): Result<InvestmentCalculation, InvestmentCalculationError> {
    if (scenario.titleType !== TitleType.CDB) {
      return Result.err(
        new InvestmentCalculationError(
          'INVESTMENT_TITLE_UNSUPPORTED',
          'only CDB titles are supported',
          { titleType: scenario.titleType },
        ),
      );
    }
    const periods = accrualPeriodsBetween(
      this.calendar,
      scenario.investmentDate,
      scenario.maturityDate,
    );
    if (periods.isErr()) return Result.err(periods.error);
    const rates = resolveAccrualRates(scenario, periods.value);
    if (rates.isErr()) return Result.err(rates.error);

    // Inputs are validated; only numeric overflow can fail from here on.
    return Result.fromThrowable(
      () => this.compute(scenario, rates.value),
      InvestmentCalculationError.failed,
    );
  }

  private compute(
    scenario: InvestmentScenario,
    rates: readonly AccrualRate[],
  ): InvestmentCalculation {
    const principal = scenario.principal;
    const dailyBalances = this.accrue(principal, rates);
    const grossBalance = dailyBalances[dailyBalances.length - 1].grossBalance;
    const grossEarnings = grossBalance.subtract(principal);
    const taxes = this.cdbTaxes.calculate(
      grossEarnings,
      scenario.holdingPeriodCalendarDays,
    );
    return {
      methodologyVersion: METHODOLOGY_VERSION,
      dailyBalances,
      maturitySummary: {
        principal,
        grossBalance,
        grossEarnings,
        ...taxes,
        netBalance: grossBalance.subtract(taxes.totalTaxes),
      },
    };
  }

  private accrue(
    principal: Money,
    rates: readonly AccrualRate[],
  ): DailyInvestmentBalance[] {
    // Curves repeat rates across many days; the fractional power is costly.
    const factors = new Map<string, Decimal>();
    let previousBalance = principal;
    return rates.map(({ balanceDate, annualRate, percentage }) => {
      const key = `${annualRate}|${percentage}`;
      let factor = factors.get(key);
      if (!factor) {
        factor = dailyAccrualFactor(annualRate, percentage);
        factors.set(key, factor);
      }
      const grossBalance = previousBalance.times(factor);
      const balance = {
        date: balanceDate,
        grossBalance,
        dailyGrossEarnings: grossBalance.subtract(previousBalance),
        accumulatedGrossEarnings: grossBalance.subtract(principal),
      };
      previousBalance = grossBalance;
      return balance;
    });
  }
}
