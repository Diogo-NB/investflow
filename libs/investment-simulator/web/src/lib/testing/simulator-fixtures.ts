import type {
  SimulationResult,
  TaxRules,
  CurveOption,
  OfferOption,
  RemunerationOption,
  SimulationOptions,
  SimulationWorkspace,
} from '../simulations/models/simulation.types';

export const cdiCurve: CurveOption = {
  id: 'cdi',
  name: 'CDI Local',
  description: null,
  origin: 'SYSTEM',
  coverage: { startDate: '2026-01-01', endDate: '2028-12-31' },
};

export const selicCurve: CurveOption = {
  ...cdiCurve,
  id: 'selic',
  name: 'SELIC Local',
};

export const remunerations: RemunerationOption[] = [
  { kind: 'PREFIXED', index: null, unsupportedReason: null, curves: [] },
  {
    kind: 'CDI_PERCENTAGE',
    index: 'CDI',
    unsupportedReason: null,
    curves: [cdiCurve],
  },
  {
    kind: 'SELIC_PERCENTAGE',
    index: 'SELIC',
    unsupportedReason: null,
    curves: [selicCurve],
  },
  {
    kind: 'IPCA_PLUS',
    index: 'IPCA',
    unsupportedReason: 'INVESTMENT_REMUNERATION_UNSUPPORTED',
    curves: [],
  },
];

export const selicOffer: OfferOption = {
  id: 'offer',
  titleType: 'CDB',
  name: 'CDB 100% da SELIC',
  origin: 'SYSTEM',
  revision: 1,
  issuerName: 'Outro',
  maturityDate: '2028-12-29',
  redemptionTerms: { kind: 'AT_MATURITY' },
  remunerationTerms: { kind: 'SELIC_PERCENTAGE', rate: '1' },
  unsupportedReason: null,
};

export const cdiOffer: OfferOption = {
  id: 'cdi-offer',
  titleType: 'CDB',
  name: 'CDB 105% do CDI',
  origin: 'OWN',
  revision: 2,
  issuerName: 'Banco Local',
  maturityDate: '2026-03-02',
  redemptionTerms: { kind: 'DAILY' },
  remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1.05' },
  unsupportedReason: null,
};

const IOF_PERCENTAGES = [
  96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36,
  33, 30, 26, 23, 20, 16, 13, 10, 6, 3,
];

export const taxRules: TaxRules = {
  iof: {
    exemptFromCalendarDays: 30,
    dailyRates: IOF_PERCENTAGES.map((percentage, index) => ({
      calendarDay: index + 1,
      rate: (percentage / 100).toString(),
    })),
  },
  incomeTax: {
    brackets: [
      { fromCalendarDays: 1, upToCalendarDays: 180, rate: '0.225' },
      { fromCalendarDays: 181, upToCalendarDays: 360, rate: '0.2' },
      { fromCalendarDays: 361, upToCalendarDays: 720, rate: '0.175' },
      { fromCalendarDays: 721, upToCalendarDays: null, rate: '0.15' },
    ],
  },
};

export const options: SimulationOptions = {
  titleTypes: [
    { titleType: 'CDB', incomeTaxExempt: false, minimumTermMonths: null },
    { titleType: 'LCI', incomeTaxExempt: true, minimumTermMonths: 9 },
    { titleType: 'LCA', incomeTaxExempt: true, minimumTermMonths: 9 },
  ],
  remunerations,
  offers: [selicOffer, cdiOffer],
  taxRules,
};

export function simulationResult(
  overrides: Partial<SimulationResult> = {},
): SimulationResult {
  return {
    calculatedAt: '2026-10-10T12:00:00.000Z',
    methodologyVersion: 'cdb-252-v1',
    outdated: false,
    principal: '10000',
    term: {
      investmentDate: '2026-01-02',
      maturityDate: '2026-03-02',
      businessDays: 40,
      calendarDays: 59,
    },
    gross: {
      finalBalance: '10217.38395154335823',
      earnings: '217.38395154335823',
      rateOfReturn: {
        forPeriod: '0.021738395154335823',
        annual: '0.144468126410318',
        monthly: '0.011305617245902',
      },
    },
    net: {
      finalBalance: '10168.472562446102112',
      earnings: '168.472562446102112',
      rateOfReturn: {
        forPeriod: '0.0168472562446102112',
        annual: '0.111281466381612',
        monthly: '0.008830254377311',
      },
    },
    taxes: {
      iof: {
        base: '217.38395154335823',
        rate: null,
        amount: '0',
        formula: 'Isento: prazo de 30 dias ou mais',
      },
      incomeTax: {
        base: '217.38395154335823',
        rate: '0.225',
        amount: '48.911389097256118',
        formula: 'R$ 217,38 × 22,5% = R$ 48,91',
      },
      total: '48.911389097256118',
    },
    ...overrides,
  };
}

export const workspace: SimulationWorkspace = {
  simulation: {
    id: 'sim',
    revision: 3,
    investment: {
      principal: '10000',
      investmentDate: '2026-01-02',
      curveId: 'cdi',
    },
  },
  offer: {
    id: cdiOffer.id,
    titleType: cdiOffer.titleType,
    name: cdiOffer.name,
    origin: cdiOffer.origin,
    revision: cdiOffer.revision,
    issuerName: cdiOffer.issuerName,
    maturityDate: cdiOffer.maturityDate,
    redemptionTerms: cdiOffer.redemptionTerms,
    remunerationTerms: cdiOffer.remunerationTerms,
    deleted: false,
  },
  curve: {
    id: 'cdi',
    name: 'CDI Local',
    deleted: false,
    lastIntervalEnd: '2028-12-31',
  },
  calculation: {
    status: 'CALCULATED',
    changedAt: '2026-10-10T12:00:00.000Z',
    cause: { kind: 'SIMULATION_EDITED' },
    reason: null,
  },
  remainingTerm: null,
  result: simulationResult(),
};

export const optionsRoute = {
  'GET /api/investment-simulator/simulation-options': options,
};
