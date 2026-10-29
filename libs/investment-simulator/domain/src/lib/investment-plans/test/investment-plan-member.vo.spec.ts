import { member } from './investment-plan-member-fixture';

describe('InvestmentPlanMember', () => {
  it('has a current result when it was calculated from the present premises', () => {
    expect(member().isResultCurrent).toBe(true);
  });

  it('has a stale result after the simulation changed', () => {
    expect(member({ result: 'stale' }).isResultCurrent).toBe(false);
  });

  it('has no current result without a result', () => {
    expect(member({ result: 'none' }).isResultCurrent).toBe(false);
  });

  it('compares by value', () => {
    expect(member().equals(member())).toBe(true);
    expect(member().equals(member({ principal: '1000.01' }))).toBe(false);
    expect(member().equals(member({ result: 'none' }))).toBe(false);
    expect(member({ result: 'none' }).equals(member({ result: 'none' }))).toBe(
      true,
    );
  });
});
