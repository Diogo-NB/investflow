import { CalendarDate } from '@investflow/shared-domain';
import { ESimulationCalculationStatus } from '../../simulations/simulation-calculation.vo';
import { InvestmentPlanMember } from '../investment-plan-member.vo';
import { InvestmentPlanTotalsCalculator } from '../investment-plan-totals-calculator.domain-service';
import { InvestmentPlanTotals } from '../investment-plan-totals.vo';
import { member } from './investment-plan-member-fixture';

const today = CalendarDate.of('2026-10-28');
const calculator = new InvestmentPlanTotalsCalculator();

const withoutResult = () =>
  member({
    calculationStatus: ESimulationCalculationStatus.INVALID,
    result: 'none',
  });

const totalsOf = (members: InvestmentPlanMember[]) => {
  const totals = calculator.calculate(members, today);
  if (!totals) throw new Error('Expected totals');
  return totals;
};

const schedule = (totals: InvestmentPlanTotals) =>
  totals.maturityMonths.map((month) => ({
    month: `${month.year}-${String(month.month).padStart(2, '0')}`,
    simulationCount: month.simulationCount,
    maturedSimulationCount: month.maturedSimulationCount,
    netFinalBalance: month.netFinalBalance.amount.toFixed(),
    accumulatedNetFinalBalance:
      month.accumulatedNetFinalBalance.amount.toFixed(),
  }));

describe('InvestmentPlanTotalsCalculator', () => {
  it('is null when no member has a result', () => {
    expect(calculator.calculate([], today)).toBeNull();
    expect(
      calculator.calculate([withoutResult(), withoutResult()], today),
    ).toBeNull();
  });

  it('sums each amount and derives the net earnings', () => {
    const totals = totalsOf([
      member({
        principal: '1000.01',
        iof: '1.5',
        incomeTax: '20.25',
        netFinalBalance: '1080.1',
      }),
      member({
        principal: '500.02',
        iof: '0.25',
        incomeTax: '10.5',
        netFinalBalance: '540.3',
      }),
    ]);

    expect(totals.principal.amount.toFixed()).toBe('1500.03');
    expect(totals.iof.amount.toFixed()).toBe('1.75');
    expect(totals.incomeTax.amount.toFixed()).toBe('30.75');
    expect(totals.netFinalBalance.amount.toFixed()).toBe('1620.4');
    expect(totals.netEarnings.amount.toFixed()).toBe('120.37');
  });

  it('spans from the first investment to the last maturity', () => {
    const totals = totalsOf([
      member({ investmentDate: '2026-03-02', maturityDate: '2028-01-03' }),
      member({ investmentDate: '2026-01-02', maturityDate: '2026-07-01' }),
      member({ investmentDate: '2026-02-02', maturityDate: '2027-01-04' }),
    ]);

    expect(totals.period.start.toIsoString()).toBe('2026-01-02');
    expect(totals.period.end.toIsoString()).toBe('2028-01-03');
  });

  it('lists the months with a maturity in order with a running total', () => {
    const totals = totalsOf([
      member({ maturityDate: '2028-01-03', netFinalBalance: '300' }),
      member({ maturityDate: '2026-07-01', netFinalBalance: '100' }),
      member({ maturityDate: '2027-01-04', netFinalBalance: '200' }),
    ]);

    expect(schedule(totals)).toEqual([
      {
        month: '2026-07',
        simulationCount: 1,
        maturedSimulationCount: 1,
        netFinalBalance: '100',
        accumulatedNetFinalBalance: '100',
      },
      {
        month: '2027-01',
        simulationCount: 1,
        maturedSimulationCount: 0,
        netFinalBalance: '200',
        accumulatedNetFinalBalance: '300',
      },
      {
        month: '2028-01',
        simulationCount: 1,
        maturedSimulationCount: 0,
        netFinalBalance: '300',
        accumulatedNetFinalBalance: '600',
      },
    ]);
  });

  it('groups the members that mature in the same month on different days', () => {
    const totals = totalsOf([
      member({ maturityDate: '2027-01-25', netFinalBalance: '200.1' }),
      member({ maturityDate: '2026-12-31', netFinalBalance: '100' }),
      member({ maturityDate: '2027-01-04', netFinalBalance: '250.2' }),
      member({ maturityDate: '2027-01-04', netFinalBalance: '50' }),
    ]);

    expect(schedule(totals)).toEqual([
      expect.objectContaining({ month: '2026-12', simulationCount: 1 }),
      {
        month: '2027-01',
        simulationCount: 3,
        maturedSimulationCount: 0,
        netFinalBalance: '500.3',
        accumulatedNetFinalBalance: '600.3',
      },
    ]);
  });

  it('keeps apart the same month of different years', () => {
    const totals = totalsOf([
      member({ maturityDate: '2027-03-01' }),
      member({ maturityDate: '2028-03-01' }),
    ]);

    expect(schedule(totals).map(({ month }) => month)).toEqual([
      '2027-03',
      '2028-03',
    ]);
  });

  it.each([
    ['before today', '2026-10-27', 1],
    ['on today', '2026-10-28', 1],
    ['after today', '2026-10-29', 0],
  ])('counts a maturity %s as matured', (_, maturityDate, matured) => {
    expect(
      totalsOf([member({ maturityDate })]).maturityMonths[0]
        .maturedSimulationCount,
    ).toBe(matured);
  });

  it('counts the part of the current month that has matured', () => {
    const [october] = totalsOf([
      member({ maturityDate: '2026-10-01' }),
      member({ maturityDate: '2026-10-28' }),
      member({ maturityDate: '2026-10-30' }),
    ]).maturityMonths;

    expect(october.simulationCount).toBe(3);
    expect(october.maturedSimulationCount).toBe(2);
  });

  it('leaves the members without a result out and counts them', () => {
    const totals = totalsOf([
      member({ principal: '1000' }),
      withoutResult(),
      member({ principal: '500' }),
      withoutResult(),
    ]);

    expect(totals.excludedSimulationCount).toBe(2);
    expect(totals.principal.amount.toFixed()).toBe('1500');
    expect(totals.maturityMonths[0].simulationCount).toBe(2);
  });

  it('has no taxes for a plan of exempt titles', () => {
    const totals = totalsOf([
      member({ incomeTax: '0', netFinalBalance: '1090' }),
      member({ incomeTax: '0', netFinalBalance: '1095.5' }),
    ]);

    expect(totals.iof.isZero).toBe(true);
    expect(totals.incomeTax.isZero).toBe(true);
    expect(totals.netEarnings.amount.toFixed()).toBe('185.5');
  });

  it.each([
    ['all daily', ['DAILY', 'DAILY'], ['1500', '0'], ['1', '0']],
    [
      'all at maturity',
      ['AT_MATURITY', 'AT_MATURITY'],
      ['0', '1500'],
      ['0', '1'],
    ],
  ] as const)(
    'splits the principal by liquidity when %s',
    (_, [first, second], amounts, shares) => {
      const { liquidity } = totalsOf([
        member({ principal: '1000', redemption: first }),
        member({ principal: '500', redemption: second }),
      ]);

      expect([
        liquidity.dailyPrincipal.amount.toFixed(),
        liquidity.atMaturityPrincipal.amount.toFixed(),
      ]).toEqual(amounts);
      expect([
        liquidity.dailyShare.toFixed(),
        liquidity.atMaturityShare.toFixed(),
      ]).toEqual(shares);
    },
  );

  it('splits a mixed plan into shares that add up to exactly 1', () => {
    const { principal, liquidity } = totalsOf([
      member({ principal: '1000', redemption: 'DAILY' }),
      member({ principal: '2000', redemption: 'AT_MATURITY' }),
      withoutResult(),
    ]);

    expect(
      liquidity.dailyPrincipal
        .add(liquidity.atMaturityPrincipal)
        .equals(principal),
    ).toBe(true);
    expect(liquidity.dailyShare.toFixed(4)).toBe('0.3333');
    expect(liquidity.atMaturityShare.toFixed(4)).toBe('0.6667');
    expect(liquidity.dailyShare.plus(liquidity.atMaturityShare).toFixed()).toBe(
      '1',
    );
  });

  it('totals a stale result like a current one and marks them provisional', () => {
    const totals = totalsOf([
      member({ principal: '1000' }),
      member({ principal: '500', result: 'stale' }),
    ]);

    expect(totals.principal.amount.toFixed()).toBe('1500');
    expect(totals.isProvisional).toBe(true);
  });

  it.each([
    ['every result is current', [member(), member()], false],
    [
      'a member is calculating over its last result',
      [
        member(),
        member({ calculationStatus: ESimulationCalculationStatus.PENDING }),
      ],
      true,
    ],
    ['a member has no result', [member(), withoutResult()], true],
  ])('when %s, is provisional: %s', (_, members, isProvisional) => {
    expect(totalsOf(members).isProvisional).toBe(isProvisional);
  });
});
