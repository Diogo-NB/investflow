import {
  CalendarDate,
  CalendarDateRange,
  Money,
} from '@investflow/shared-domain';
import {
  InvestmentPlanTotals,
  InvestmentPlanTotalsProps,
} from '../investment-plan-totals.vo';

const props = (
  overrides: Partial<InvestmentPlanTotalsProps> = {},
): InvestmentPlanTotalsProps => ({
  excludedSimulationCount: 0,
  isProvisional: false,
  principal: Money.of('3000'),
  iof: Money.of('0'),
  incomeTax: Money.of('45.5'),
  period: CalendarDateRange.of(
    CalendarDate.of('2026-01-02'),
    CalendarDate.of('2027-01-04'),
  ),
  maturityMonths: [
    {
      year: 2026,
      month: 6,
      simulationCount: 1,
      maturedSimulationCount: 1,
      netFinalBalance: Money.of('1050.25'),
    },
    {
      year: 2027,
      month: 1,
      simulationCount: 2,
      maturedSimulationCount: 0,
      netFinalBalance: Money.of('2200.5'),
    },
  ],
  dailyPrincipal: Money.of('1000'),
  ...overrides,
});

describe('InvestmentPlanTotals', () => {
  it('derives the net amount and earnings from the months', () => {
    const totals = InvestmentPlanTotals.create(props());

    expect(totals.netFinalBalance.amount.toFixed()).toBe('3250.75');
    expect(totals.netEarnings.amount.toFixed()).toBe('250.75');
  });

  it('runs a total through the months in order', () => {
    const totals = InvestmentPlanTotals.create(props());

    expect(
      totals.maturityMonths.map(({ accumulatedNetFinalBalance }) =>
        accumulatedNetFinalBalance.amount.toFixed(),
      ),
    ).toEqual(['1050.25', '3250.75']);
  });

  it('derives the at-maturity part of the liquidity from the daily one', () => {
    const { liquidity } = InvestmentPlanTotals.create(props());

    expect(liquidity.atMaturityPrincipal.amount.toFixed()).toBe('2000');
    expect(liquidity.dailyShare.toFixed(4)).toBe('0.3333');
    expect(liquidity.dailyShare.plus(liquidity.atMaturityShare).toFixed()).toBe(
      '1',
    );
  });

  it('keeps its months apart from the list it was given', () => {
    const months = [...props().maturityMonths];
    const totals = InvestmentPlanTotals.create(
      props({ maturityMonths: months }),
    );
    months.pop();

    expect(totals.maturityMonths).toHaveLength(2);
  });

  it('compares by value', () => {
    const totals = InvestmentPlanTotals.create(props());

    expect(totals.equals(InvestmentPlanTotals.create(props()))).toBe(true);
    expect(
      totals.equals(
        InvestmentPlanTotals.create(props({ isProvisional: true })),
      ),
    ).toBe(false);
    expect(
      totals.equals(InvestmentPlanTotals.create(props({ maturityMonths: [] }))),
    ).toBe(false);
  });
});
