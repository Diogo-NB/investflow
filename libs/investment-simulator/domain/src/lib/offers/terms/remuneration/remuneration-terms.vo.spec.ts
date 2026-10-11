import { Rate } from '@investflow/shared-domain';
import { EEconomicIndex } from '../../../curves/economic-index.enum';
import {
  IndexPercentageRemuneration,
  IpcaPlusRemuneration,
  PrefixedRemuneration,
  RemunerationTerms,
} from './remuneration-terms.vo';

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
    expect(terms.contractRate).toBe(rate);
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

describe('RemunerationTerms variants', () => {
  it('names the rate by its meaning and the index the terms require', () => {
    const rate = Rate.of('1.05');
    const prefixed = RemunerationTerms.create('PREFIXED', rate);
    const cdi = RemunerationTerms.create('CDI_PERCENTAGE', rate);
    const selic = RemunerationTerms.create('SELIC_PERCENTAGE', rate);
    const ipca = RemunerationTerms.create('IPCA_PLUS', rate);

    expect(prefixed).toBeInstanceOf(PrefixedRemuneration);
    expect((prefixed as PrefixedRemuneration).annualRate).toBe(rate);
    expect(prefixed.requiredIndex).toBeNull();
    expect(cdi).toBeInstanceOf(IndexPercentageRemuneration);
    expect((cdi as IndexPercentageRemuneration).percentage).toBe(rate);
    expect(cdi.requiredIndex).toBe(EEconomicIndex.CDI);
    expect(selic.requiredIndex).toBe(EEconomicIndex.SELIC);
    expect(ipca).toBeInstanceOf(IpcaPlusRemuneration);
    expect((ipca as IpcaPlusRemuneration).annualSpread).toBe(rate);
    expect(ipca.requiredIndex).toBe(EEconomicIndex.IPCA);
    for (const terms of [prefixed, cdi, selic, ipca]) {
      expect(RemunerationTerms.requiredIndex(terms.kind)).toBe(
        terms.requiredIndex,
      );
    }
  });
});
