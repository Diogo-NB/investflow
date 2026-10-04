import { Rate } from '@investflow/shared-domain';
import { RemunerationTerms } from './remuneration-terms.vo';

const KINDS = [
  'PREFIXED',
  'IPCA_PLUS',
  'CDI_PERCENTAGE',
  'SELIC_PERCENTAGE',
] as const;

describe.each(KINDS)('%s remuneration terms', (kind) => {
  it('preserves the kind and rate', () => {
    const rate = Rate.of('12.345678901234567890123456789');
    const terms = RemunerationTerms.create(kind, rate);

    expect(terms.kind).toBe(kind);
    expect(terms.rate).toBe(rate);
  });

  it('compares rates by numeric value', () => {
    const terms = RemunerationTerms.create(kind, Rate.of('12'));
    const equivalent = RemunerationTerms.create(kind, Rate.of('12.0'));

    expect(terms.equals(equivalent)).toBe(true);
    expect(equivalent.equals(terms)).toBe(true);
    expect(terms.equals(RemunerationTerms.create(kind, Rate.of('13')))).toBe(
      false,
    );
  });

  it('distinguishes other kinds with the same rate', () => {
    const terms = RemunerationTerms.create(kind, Rate.of('12'));

    for (const otherKind of KINDS) {
      const candidate = RemunerationTerms.create(otherKind, Rate.of('12'));
      expect(terms.equals(candidate)).toBe(kind === otherKind);
      expect(candidate.equals(terms)).toBe(kind === otherKind);
    }
  });
});
