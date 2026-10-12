import {
  BusinessDayCalendar,
  CalendarDate,
  CalendarDateRange,
  EAppErrorCode,
  Money,
  Result,
} from '@investflow/shared-domain';
import Decimal from 'decimal.js';
import type { RemunerationKind } from '../offers/terms/remuneration/remuneration-terms.vo';
import { TITLE_TYPE_RULES } from '../offers/title-type-rules';
import { TaxCalculator } from '../taxes/tax-calculator.domain-service';
import {
  InvestmentCalculationError,
  UnsupportedCalculationCode,
} from './investment-calculation.error';
import {
  DailyInvestmentBalance,
  InvestmentCalculation,
} from './investment-calculation.type';
import { InvestmentScenario } from './investment-scenario.vo';

const BUSINESS_DAYS_PER_YEAR = 252;
const FULL_RATE = new Decimal(1);

// The rate of one business day remunerates until the next business day, where
// the resulting balance is presented.
interface AccrualPeriod {
  readonly rateReferenceDate: CalendarDate;
  readonly balanceDate: CalendarDate;
}

// A period priced as a percentage of an annual effective rate (base 252).
// A fixed rate is earned in full; an index rate in the contracted percentage.
interface AccrualRate extends AccrualPeriod {
  readonly annualRate: Decimal;
  readonly percentage: Decimal;
}

export class InvestmentCalculator {
  private readonly taxes = new TaxCalculator();

  constructor(private readonly calendar: BusinessDayCalendar) {}

  // The IPCA contractual profile is not defined yet.
  static unsupportedReason(
    remunerationKind: RemunerationKind,
  ): UnsupportedCalculationCode | null {
    return remunerationKind === 'IPCA_PLUS'
      ? EAppErrorCode.INVESTMENT_REMUNERATION_UNSUPPORTED
      : null;
  }

  // The rules a calculation can break before its rates are read; curve
  // coverage is found only by calculate().
  check(
    scenario: InvestmentScenario,
  ): Result<void, InvestmentCalculationError> {
    const unsupported = InvestmentCalculator.unsupportedReason(
      scenario.remuneration.kind,
    );
    if (unsupported) {
      return Result.err(
        InvestmentCalculationError.unsupported(unsupported, {
          remunerationKind: scenario.remuneration.kind,
        }),
      );
    }
    const { investmentDate, maturityDate } = scenario;
    if (!this.calendar.isBusinessDay(investmentDate)) {
      return Result.err(
        InvestmentCalculationError.notBusinessDay(
          'investmentDate',
          investmentDate,
        ),
      );
    }
    if (!this.calendar.isBusinessDay(maturityDate)) {
      return Result.err(
        InvestmentCalculationError.notBusinessDay('maturityDate', maturityDate),
      );
    }
    return Result.ok(undefined);
  }

  calculate(
    scenario: InvestmentScenario,
  ): Result<InvestmentCalculation, InvestmentCalculationError> {
    const checked = this.check(scenario);
    if (checked.isErr()) return checked;
    const rates = this.accrualRates(scenario, this.accrualPeriods(scenario));
    if (rates.isErr()) return rates;

    // Inputs are validated; only numeric overflow can fail from here on.
    return Result.fromThrowable(
      () => this.compute(scenario, rates.value),
      InvestmentCalculationError.failed,
    );
  }

  // InvestmentScenario guarantees the investment date precedes maturity, and
  // check() that both are business days.
  private accrualPeriods({
    investmentDate,
    maturityDate,
  }: InvestmentScenario): AccrualPeriod[] {
    // Each business day closes the period opened by the previous one; the
    // investment date only opens the first period.
    const businessDays = CalendarDateRange.of(
      investmentDate,
      maturityDate,
    ).datesBetween.filter(this.calendar.isBusinessDay);

    return businessDays.slice(1).map((balanceDate, index) => ({
      rateReferenceDate: businessDays[index],
      balanceDate,
    }));
  }

  private accrualRates(
    scenario: InvestmentScenario,
    periods: readonly AccrualPeriod[],
  ): Result<AccrualRate[], InvestmentCalculationError> {
    const remuneration = scenario.remuneration;
    switch (remuneration.kind) {
      case 'PREFIXED':
        return Result.ok(
          periods.map((period) => ({
            ...period,
            annualRate: remuneration.annualRate.value,
            percentage: FULL_RATE,
          })),
        );
      case 'CDI_PERCENTAGE':
      case 'SELIC_PERCENTAGE':
        return scenario
          .requireCurve()
          .valuesAt(periods.map((period) => period.rateReferenceDate))
          .map((values) =>
            periods.map((period, index) => ({
              ...period,
              annualRate: values[index].value,
              percentage: remuneration.percentage.value,
            })),
          )
          .mapError(
            (error) =>
              new InvestmentCalculationError(
                EAppErrorCode.INVESTMENT_CURVE_COVERAGE_MISSING,
                error.message,
                error.metadata,
              ),
          );
      case 'IPCA_PLUS':
        // check() rejects it earlier through unsupportedReason().
        return Result.err(
          InvestmentCalculationError.unsupported(
            EAppErrorCode.INVESTMENT_REMUNERATION_UNSUPPORTED,
            { remunerationKind: remuneration.kind },
          ),
        );
    }
  }

  private compute(
    scenario: InvestmentScenario,
    rates: readonly AccrualRate[],
  ): InvestmentCalculation {
    const principal = scenario.principal;
    const dailyBalances = this.accrue(principal, rates);
    const grossBalance = dailyBalances[dailyBalances.length - 1].grossBalance;
    const grossEarnings = grossBalance.subtract(principal);
    const taxes = this.taxes.assess(
      scenario.titleType,
      grossEarnings,
      scenario.holdingPeriodCalendarDays,
    );
    return {
      methodologyVersion:
        TITLE_TYPE_RULES[scenario.titleType].methodologyVersion,
      dailyBalances,
      maturitySummary: {
        principal,
        grossBalance,
        grossEarnings,
        netBalance: grossBalance.subtract(taxes.total),
      },
      taxes,
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
        factor = this.dailyAccrualFactor(annualRate, percentage);
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

  // Converts an annual effective rate (base 252) to its daily equivalent and
  // earns the contracted percentage of it: 1 + ((1 + annual)^(1/252) - 1) * pct.
  private dailyAccrualFactor(
    annualRate: Decimal,
    percentage: Decimal,
  ): Decimal {
    const dailyRate = annualRate
      .plus(1)
      .pow(new Decimal(1).div(BUSINESS_DAYS_PER_YEAR))
      .minus(1);
    return dailyRate.times(percentage).plus(1);
  }
}
