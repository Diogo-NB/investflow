import type { Prisma } from '@prisma/client';

export const issuer = {
  name: 'Banco Local',
} satisfies Prisma.InvestmentIssuerCreateInput;

// The last business day of 2028, so offers calculate without edits.
const offerDefaults = {
  maturityDate: new Date('2028-12-29T00:00:00.000Z'),
  deletedAt: null,
} as const;

export const offers = [
  {
    ...offerDefaults,
    titleType: 'CDB',
    redemptionType: 'DAILY',
    remunerationType: 'CDI_PERCENTAGE',
    rateValue: '1.10',
  },
  {
    ...offerDefaults,
    titleType: 'CDB',
    redemptionType: 'DAILY',
    remunerationType: 'SELIC_PERCENTAGE',
    rateValue: '1.00',
  },
  {
    ...offerDefaults,
    titleType: 'LCI',
    redemptionType: 'AT_MATURITY',
    remunerationType: 'PREFIXED',
    rateValue: '0.12',
  },
  {
    ...offerDefaults,
    titleType: 'LCI',
    redemptionType: 'AT_MATURITY',
    remunerationType: 'CDI_PERCENTAGE',
    rateValue: '0.95',
  },
  {
    ...offerDefaults,
    titleType: 'LCA',
    redemptionType: 'AT_MATURITY',
    remunerationType: 'CDI_PERCENTAGE',
    rateValue: '0.93',
  },
  {
    ...offerDefaults,
    titleType: 'LCA',
    redemptionType: 'AT_MATURITY',
    remunerationType: 'IPCA_PLUS',
    rateValue: '0.06',
  },
] satisfies Omit<Prisma.InvestmentOfferUncheckedCreateInput, 'issuerId'>[];

// Snapshot as of 2026-10-05; seeding never fetches market data.
// Effective SELIC and DI: https://www.anbima.com.br/informacoes/indicadores/
// August 2026 trailing IPCA: https://www.ibge.gov.br/explica/inflacao.php
// Monthly IPCA = (1.0422)^(1/12) - 1, rounded to the database's 30 decimal places.
const curveDefaults = {
  deletedAt: null,
} as const;

export const curves = [
  {
    ...curveDefaults,
    name: 'CDI Local',
    index: 'CDI',
    description:
      'Local fixture: DI-B3 at 13.65% annually (252-day basis), reported by ANBIMA on 2026-10-05; held constant for 2024–2028.',
    value: '0.1365',
  },
  {
    ...curveDefaults,
    name: 'SELIC Local',
    index: 'SELIC',
    description:
      'Local fixture: effective SELIC at 13.65% annually (252-day basis), reported by ANBIMA on 2026-10-05; held constant for 2024–2028.',
    value: '0.1365',
  },
  {
    ...curveDefaults,
    name: 'IPCA Local',
    index: 'IPCA',
    description:
      'Local fixture: August 2026 IPCA at 4.22% over 12 months, published on 2026-09-11 and available as of 2026-10-05; monthly equivalent (1.0422)^(1/12) - 1 repeated for every month in 2024–2028.',
    value: '0.003450427692416233215455407623',
  },
] satisfies (Prisma.IndexCurveCreateWithoutIntervalsInput & {
  value: string;
})[];

export const curveRange = {
  startDate: new Date('2024-01-01T00:00:00.000Z'),
  endDate: new Date('2028-12-31T00:00:00.000Z'),
};
