import {
  CalendarDateRange,
  Money,
  ValueObject,
} from '@investflow/shared-domain';
import Decimal from 'decimal.js';

// The members that mature in one calendar month.
export interface InvestmentPlanMaturityMonth {
  readonly year: number;
  // 1 to 12.
  readonly month: number;
  readonly simulationCount: number;
  // Those whose maturity date is on or before today.
  readonly maturedSimulationCount: number;
  readonly netFinalBalance: Money;
  // This month's net amount plus every earlier month's.
  readonly accumulatedNetFinalBalance: Money;
}

// Splits the principal included in the totals between what can be redeemed
// any day and what only at maturity.
export interface InvestmentPlanLiquidity {
  readonly dailyPrincipal: Money;
  readonly atMaturityPrincipal: Money;
  // Fractions that add up to exactly 1.
  readonly dailyShare: Decimal;
  readonly atMaturityShare: Decimal;
}

export interface InvestmentPlanTotalsProps {
  // Members without a result, left out of every amount.
  readonly excludedSimulationCount: number;
  // Some member is calculating, has a pending issue, or a stale result.
  readonly isProvisional: boolean;
  readonly principal: Money;
  readonly iof: Money;
  readonly incomeTax: Money;
  // From the first investment date to the last maturity.
  readonly period: CalendarDateRange;
  // Ascending, only the months with a maturity.
  readonly maturityMonths: readonly Omit<
    InvestmentPlanMaturityMonth,
    'accumulatedNetFinalBalance'
  >[];
  readonly dailyPrincipal: Money;
}

// How much a plan invests, gets back, and when: each member's last
// successful result at its own maturity, summed without reinvestment.
// Derived at read time and never stored. The net amount, net earnings, the
// running totals, and the at-maturity split are derived here from the other
// facts, so they cannot disagree with them.
export class InvestmentPlanTotals extends ValueObject<InvestmentPlanTotals> {
  readonly netFinalBalance: Money;
  readonly netEarnings: Money;
  readonly maturityMonths: readonly InvestmentPlanMaturityMonth[];
  readonly liquidity: InvestmentPlanLiquidity;

  private constructor(private readonly props: InvestmentPlanTotalsProps) {
    super();
    let accumulated = Money.zero();
    this.maturityMonths = props.maturityMonths.map((month) => {
      accumulated = accumulated.add(month.netFinalBalance);
      return { ...month, accumulatedNetFinalBalance: accumulated };
    });
    this.netFinalBalance = accumulated;
    this.netEarnings = accumulated.subtract(props.principal);
    const dailyShare = props.dailyPrincipal.amount.div(props.principal.amount);
    this.liquidity = {
      dailyPrincipal: props.dailyPrincipal,
      atMaturityPrincipal: props.principal.subtract(props.dailyPrincipal),
      dailyShare,
      atMaturityShare: new Decimal(1).minus(dailyShare),
    };
  }

  // The principal is positive whenever a member is included.
  static create(props: InvestmentPlanTotalsProps): InvestmentPlanTotals {
    return new InvestmentPlanTotals({
      ...props,
      maturityMonths: [...props.maturityMonths],
    });
  }

  get excludedSimulationCount(): number {
    return this.props.excludedSimulationCount;
  }

  get isProvisional(): boolean {
    return this.props.isProvisional;
  }

  get principal(): Money {
    return this.props.principal;
  }

  get iof(): Money {
    return this.props.iof;
  }

  get incomeTax(): Money {
    return this.props.incomeTax;
  }

  get period(): CalendarDateRange {
    return this.props.period;
  }

  equals(other: InvestmentPlanTotals): boolean {
    const mine = this.props;
    const theirs = other.props;
    return (
      mine.excludedSimulationCount === theirs.excludedSimulationCount &&
      mine.isProvisional === theirs.isProvisional &&
      mine.principal.equals(theirs.principal) &&
      mine.iof.equals(theirs.iof) &&
      mine.incomeTax.equals(theirs.incomeTax) &&
      mine.period.equals(theirs.period) &&
      mine.dailyPrincipal.equals(theirs.dailyPrincipal) &&
      mine.maturityMonths.length === theirs.maturityMonths.length &&
      mine.maturityMonths.every((month, index) => {
        const their = theirs.maturityMonths[index];
        return (
          month.year === their.year &&
          month.month === their.month &&
          month.simulationCount === their.simulationCount &&
          month.maturedSimulationCount === their.maturedSimulationCount &&
          month.netFinalBalance.equals(their.netFinalBalance)
        );
      })
    );
  }
}
