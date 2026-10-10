import { remunerationLabel } from './offer-terms';

it('labels each remuneration with its own unit', () => {
  expect(remunerationLabel({ kind: 'CDI_PERCENTAGE', rate: '1.1' })).toBe(
    '110% do CDI',
  );
  expect(remunerationLabel({ kind: 'SELIC_PERCENTAGE', rate: '1' })).toBe(
    '100% da SELIC',
  );
  expect(remunerationLabel({ kind: 'PREFIXED', rate: '0.125' })).toBe(
    '12,5% a.a.',
  );
  expect(remunerationLabel({ kind: 'IPCA_PLUS', rate: '0.06' })).toBe(
    'IPCA + 6% a.a.',
  );
});
