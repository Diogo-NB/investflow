import { EEconomicIndex } from '@investflow/investment-simulator-domain';

interface BcbInterval {
  startDate: string;
  endDate: string;
  value: string;
}

// Frozen copy of what the Banco Central published through 2026-10-30, so the
// run needs no network access and reviewers see exactly what it writes. SGS
// publishes percentages; curves store fractions (11.65 is 0.1165).
const cdiIntervals: readonly BcbInterval[] = [
  { startDate: '2024-01-02', endDate: '2024-01-31', value: '0.1165' },
  { startDate: '2024-02-01', endDate: '2024-03-20', value: '0.1115' },
  { startDate: '2024-03-21', endDate: '2024-05-08', value: '0.1065' },
  { startDate: '2024-05-09', endDate: '2024-09-18', value: '0.104' },
  { startDate: '2024-09-19', endDate: '2024-11-06', value: '0.1065' },
  { startDate: '2024-11-07', endDate: '2024-12-11', value: '0.1115' },
  { startDate: '2024-12-12', endDate: '2025-01-29', value: '0.1215' },
  { startDate: '2025-01-30', endDate: '2025-03-19', value: '0.1315' },
  { startDate: '2025-03-20', endDate: '2025-05-07', value: '0.1415' },
  { startDate: '2025-05-08', endDate: '2025-06-18', value: '0.1465' },
  { startDate: '2025-06-20', endDate: '2026-03-18', value: '0.149' },
  { startDate: '2026-03-19', endDate: '2026-04-29', value: '0.1465' },
  { startDate: '2026-04-30', endDate: '2026-06-17', value: '0.144' },
  { startDate: '2026-06-18', endDate: '2026-08-05', value: '0.1415' },
  { startDate: '2026-08-06', endDate: '2026-09-16', value: '0.139' },
  { startDate: '2026-09-17', endDate: '2026-10-30', value: '0.1365' },
];

const selicIntervals: readonly BcbInterval[] = [
  { startDate: '2024-01-02', endDate: '2024-01-31', value: '0.1165' },
  { startDate: '2024-02-01', endDate: '2024-03-20', value: '0.1115' },
  { startDate: '2024-03-21', endDate: '2024-05-08', value: '0.1065' },
  { startDate: '2024-05-09', endDate: '2024-09-18', value: '0.104' },
  { startDate: '2024-09-19', endDate: '2024-11-06', value: '0.1065' },
  { startDate: '2024-11-07', endDate: '2024-12-11', value: '0.1115' },
  { startDate: '2024-12-12', endDate: '2025-01-29', value: '0.1215' },
  { startDate: '2025-01-30', endDate: '2025-03-19', value: '0.1315' },
  { startDate: '2025-03-20', endDate: '2025-05-07', value: '0.1415' },
  { startDate: '2025-05-08', endDate: '2025-06-18', value: '0.1465' },
  { startDate: '2025-06-20', endDate: '2026-03-18', value: '0.149' },
  { startDate: '2026-03-19', endDate: '2026-04-29', value: '0.1465' },
  { startDate: '2026-04-30', endDate: '2026-06-17', value: '0.144' },
  { startDate: '2026-06-18', endDate: '2026-08-05', value: '0.1415' },
  { startDate: '2026-08-06', endDate: '2026-09-16', value: '0.139' },
  { startDate: '2026-09-17', endDate: '2026-10-30', value: '0.1365' },
];

export const bcbSystemCurves = [
  {
    index: EEconomicIndex.CDI,
    name: 'CDI',
    description:
      'Taxa CDI anualizada, base 252, publicada pelo Banco Central (série SGS 4389) até 30/10/2026. Depois disso, a última taxa é mantida.',
    intervals: cdiIntervals,
  },
  {
    index: EEconomicIndex.SELIC,
    name: 'SELIC',
    description:
      'Taxa SELIC efetiva anualizada, base 252, publicada pelo Banco Central (série SGS 1178) até 30/10/2026. Depois disso, a última taxa é mantida.',
    intervals: selicIntervals,
  },
];
