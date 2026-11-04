// The last business day of 2028, so offers calculate without edits.
const offerDefaults = {
  maturityDate: '2028-12-29',
  issuerName: 'Banco Local',
} as const;

// Each is a system offer.
export const offers = [
  {
    ...offerDefaults,
    titleType: 'CDB',
    redemptionTerms: { kind: 'DAILY' },
    remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1.10' },
  },
  {
    ...offerDefaults,
    titleType: 'CDB',
    redemptionTerms: { kind: 'DAILY' },
    remunerationTerms: { kind: 'SELIC_PERCENTAGE', rate: '1.00' },
  },
  {
    ...offerDefaults,
    titleType: 'LCI',
    redemptionTerms: { kind: 'AT_MATURITY' },
    remunerationTerms: { kind: 'PREFIXED', rate: '0.12' },
  },
  {
    ...offerDefaults,
    titleType: 'LCI',
    redemptionTerms: { kind: 'AT_MATURITY' },
    remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '0.95' },
  },
  {
    ...offerDefaults,
    titleType: 'LCA',
    redemptionTerms: { kind: 'AT_MATURITY' },
    remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '0.93' },
  },
  {
    ...offerDefaults,
    titleType: 'LCA',
    redemptionTerms: { kind: 'AT_MATURITY' },
    remunerationTerms: { kind: 'IPCA_PLUS', rate: '0.06' },
  },
] as const;

// Snapshot as of 2026-10-05; seeding never fetches market data.
// Effective SELIC and DI: https://www.anbima.com.br/informacoes/indicadores/
// August 2026 trailing IPCA: https://www.ibge.gov.br/explica/inflacao.php
const curveRange = { startDate: '2024-01-01', endDate: '2028-12-31' };

// Monthly IPCA = (1.0422)^(1/12) - 1, rounded to the database's 30 decimal places.
// Each is a system curve covering 2024–2028.
export const curves = [
  // The curves the index values importer keeps current, ending where a first
  // import with --start-date=2026-10-31 continues, as in production.
  {
    index: 'CDI',
    name: 'CDI',
    description: 'Local fixture: the curve the Banco Central import updates.',
    value: '0.1365',
    range: { startDate: '2026-09-17', endDate: '2026-10-30' },
  },
  {
    index: 'SELIC',
    name: 'SELIC',
    description: 'Local fixture: the curve the Banco Central import updates.',
    value: '0.1365',
    range: { startDate: '2026-09-17', endDate: '2026-10-30' },
  },
  {
    index: 'CDI',
    name: 'CDI Local',
    description:
      'Local fixture: DI-B3 at 13.65% annually (252-day basis), reported by ANBIMA on 2026-10-05; held constant for 2024–2028.',
    value: '0.1365',
    range: curveRange,
  },
  {
    index: 'SELIC',
    name: 'SELIC Local',
    description:
      'Local fixture: effective SELIC at 13.65% annually (252-day basis), reported by ANBIMA on 2026-10-05; held constant for 2024–2028.',
    value: '0.1365',
    range: curveRange,
  },
  {
    index: 'IPCA',
    name: 'IPCA Local',
    description:
      'Local fixture: August 2026 IPCA at 4.22% over 12 months, published on 2026-09-11 and available as of 2026-10-05; monthly equivalent (1.0422)^(1/12) - 1 repeated for every month in 2024–2028.',
    value: '0.003450427692416233215455407623',
    range: curveRange,
  },
] as const;
