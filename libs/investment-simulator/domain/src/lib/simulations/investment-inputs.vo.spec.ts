import { Money } from '@investflow/shared-domain';
import { investment } from './simulation-fixture';

describe('InvestmentInputs', () => {
  it('compares by value', () => {
    expect(investment().equals(investment())).toBe(true);
    expect(
      investment().equals(investment({ principal: Money.of('1000.00') })),
    ).toBe(true);
    expect(
      investment().equals(investment({ principal: Money.of('1001') })),
    ).toBe(false);
    expect(investment().equals(investment({ curveId: 'curve' }))).toBe(false);
  });
});
