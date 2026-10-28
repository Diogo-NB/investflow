import {
  CalendarDate,
  CalendarDateRange,
  Money,
} from '@investflow/shared-domain';
import {
  InvestmentPlanMember,
  InvestmentPlanMemberResult,
} from './investment-plan-member.vo';
import { InvestmentPlanStatus } from './investment-plan-status.vo';
import {
  InvestmentPlanTotals,
  InvestmentPlanTotalsProps,
} from './investment-plan-totals.vo';

type IncludedMember = {
  readonly result: InvestmentPlanMemberResult;
  readonly member: InvestmentPlanMember;
};

// Totals a plan's live members from each one's last successful result,
// current or not. A member without a result is left out and counted.
export class InvestmentPlanTotalsCalculator {
  // Null when no member has a result.
  calculate(
    members: readonly InvestmentPlanMember[],
    today: CalendarDate,
  ): InvestmentPlanTotals | null {
    const included = members.flatMap((member) =>
      member.lastResult ? [{ result: member.lastResult, member }] : [],
    );
    if (included.length === 0) return null;
    const sum = (amountOf: (result: InvestmentPlanMemberResult) => Money) =>
      included.reduce(
        (total, { result }) => total.add(amountOf(result)),
        Money.zero(),
      );
    return InvestmentPlanTotals.create({
      excludedSimulationCount: members.length - included.length,
      isProvisional: !InvestmentPlanStatus.of(members).isSettled,
      principal: sum(({ principal }) => principal),
      iof: sum(({ iof }) => iof),
      incomeTax: sum(({ incomeTax }) => incomeTax),
      period: this.periodOf(included),
      maturityMonths: this.maturityMonthsOf(included, today),
      dailyPrincipal: included
        .filter(({ member }) => member.redemptionTerms.kind === 'DAILY')
        .reduce(
          (total, { result }) => total.add(result.principal),
          Money.zero(),
        ),
    });
  }

  private periodOf(included: readonly IncludedMember[]): CalendarDateRange {
    const [{ result: first }, ...rest] = included;
    let start = first.investmentDate;
    let end = first.maturityDate;
    for (const { result } of rest) {
      if (result.investmentDate.isBefore(start)) start = result.investmentDate;
      if (result.maturityDate.isAfter(end)) end = result.maturityDate;
    }
    return CalendarDateRange.of(start, end);
  }

  private maturityMonthsOf(
    included: readonly IncludedMember[],
    today: CalendarDate,
  ): InvestmentPlanTotalsProps['maturityMonths'] {
    const byMonth = new Map<
      number,
      InvestmentPlanTotalsProps['maturityMonths'][number]
    >();
    for (const { result } of included) {
      const { year, month } = result.maturityDate;
      const key = year * 12 + month;
      const group = byMonth.get(key);
      const matured = result.maturityDate.isOnOrBefore(today) ? 1 : 0;
      byMonth.set(key, {
        year,
        month,
        simulationCount: (group?.simulationCount ?? 0) + 1,
        maturedSimulationCount: (group?.maturedSimulationCount ?? 0) + matured,
        netFinalBalance: group
          ? group.netFinalBalance.add(result.netFinalBalance)
          : result.netFinalBalance,
      });
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, group]) => group);
  }
}
