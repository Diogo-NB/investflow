import { RedemptionTerms } from './redemption-terms.vo';

describe('RedemptionTerms', () => {
  it.each(['AT_MATURITY', 'DAILY'] as const)('creates %s terms', (kind) => {
    const terms = RedemptionTerms.create(kind);

    expect(terms.kind).toBe(kind);
  });

  it('compares terms by kind', () => {
    const daily = RedemptionTerms.create('DAILY');

    expect(daily.equals(RedemptionTerms.create('DAILY'))).toBe(true);
    expect(daily.equals(RedemptionTerms.create('AT_MATURITY'))).toBe(false);
  });
});
