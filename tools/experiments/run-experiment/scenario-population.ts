import { BusinessDayCalendar, CalendarDate } from '@investflow/shared-domain';
import type {
  CreateOfferRequest,
  InvestflowApiClient,
  RemunerationTerms,
} from './investflow-api-client';

export enum EOfferRole {
  // The offer whose terms change while the fault is active.
  TARGET = 'target',
  UNTOUCHED = 'untouched',
}

interface OfferBlueprint {
  readonly role: EOfferRole;
  // Its share of the run's simulations.
  readonly weight: number;
  readonly usesCurve: boolean;
  readonly offer: Omit<CreateOfferRequest, 'name' | 'issuerName'>;
}

export interface PopulatedOffer {
  readonly offerId: string;
  readonly role: EOfferRole;
  readonly simulationIds: readonly string[];
}

export interface ScenarioPopulation {
  readonly curveId: string;
  readonly offers: readonly PopulatedOffer[];
  readonly targetOffer: PopulatedOffer;
  readonly simulationIds: readonly string[];
}

// The target's two term changes while the fault is active; each changes the
// result of every simulation of the offer.
export const targetRemunerationChanges: readonly RemunerationTerms[] = [
  { kind: 'CDI_PERCENTAGE', rate: '1.15' },
  { kind: 'CDI_PERCENTAGE', rate: '1.20' },
];

// Maturities are business days the curve covers. Investments start in
// 2025–2026, so the target's terms run from 6 to 30 months, across every
// income tax bracket, and the other offers' from 2 to 6 years.
const offerBlueprints: readonly OfferBlueprint[] = [
  {
    role: EOfferRole.TARGET,
    weight: 0.4,
    usesCurve: true,
    offer: {
      titleType: 'CDB',
      maturityDate: '2027-06-30',
      redemptionTerms: { kind: 'DAILY' },
      remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1.10' },
    },
  },
  {
    role: EOfferRole.UNTOUCHED,
    weight: 0.2,
    usesCurve: false,
    offer: {
      titleType: 'LCI',
      maturityDate: '2028-12-29',
      redemptionTerms: { kind: 'AT_MATURITY' },
      remunerationTerms: { kind: 'PREFIXED', rate: '0.12' },
    },
  },
  {
    role: EOfferRole.UNTOUCHED,
    weight: 0.2,
    usesCurve: false,
    offer: {
      titleType: 'CDB',
      maturityDate: '2030-12-30',
      redemptionTerms: { kind: 'AT_MATURITY' },
      remunerationTerms: { kind: 'PREFIXED', rate: '0.13' },
    },
  },
  {
    role: EOfferRole.UNTOUCHED,
    weight: 0.2,
    usesCurve: true,
    offer: {
      titleType: 'LCA',
      maturityDate: '2030-06-28',
      redemptionTerms: { kind: 'AT_MATURITY' },
      remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '0.93' },
    },
  },
];

const curveInterval = {
  startDate: '2024-01-01',
  endDate: '2031-12-31',
  value: '0.1365',
};
const firstInvestmentDate = CalendarDate.of('2025-01-02');
const investmentDateSpanDays = 729;
const minimumPrincipalCents = 100_000;
const principalSpanCents = 9_900_000;
// Requests in flight while creating simulations, as several users would.
const CREATION_CONCURRENCY = 8;

// mulberry32: small, fast, and the same sequence for the same seed.
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

// The run's own curve and offers, so no run shares premises with another,
// and its simulations, generated from the seed. Equal seeds create equal
// data, so run k of every scenario judges the same population.
export async function populateScenario(
  api: InvestflowApiClient,
  label: string,
  simulationCount: number,
  seed: number,
): Promise<ScenarioPopulation> {
  const random = seededRandom(seed);
  const curveId = await api.createCurve({
    index: 'CDI',
    name: `Experimento ${label}`,
    intervals: [curveInterval],
  });

  const offers: PopulatedOffer[] = [];
  for (const [position, blueprint] of offerBlueprints.entries()) {
    const offerId = await api.createOffer({
      ...blueprint.offer,
      name: `Experimento ${label} ${position + 1}`,
      issuerName: 'Banco Experimento',
    });
    const count = Math.round(simulationCount * blueprint.weight);
    const requests = Array.from({ length: count }, () => ({
      offerId,
      investment: {
        principal: (
          (minimumPrincipalCents + Math.floor(random() * principalSpanCents)) /
          100
        ).toFixed(2),
        investmentDate: businessDayFrom(random).toIsoString(),
        ...(blueprint.usesCurve ? { curveId } : {}),
      },
    }));
    const simulationIds = await mapConcurrently(requests, (request) =>
      api.createSimulation(request),
    );
    offers.push({ offerId, role: blueprint.role, simulationIds });
  }

  const targetOffer = offers.find(({ role }) => role === EOfferRole.TARGET);
  if (!targetOffer) throw new Error('The population has no target offer');
  return {
    curveId,
    offers,
    targetOffer,
    simulationIds: offers.flatMap(({ simulationIds }) => simulationIds),
  };
}

function businessDayFrom(random: () => number): CalendarDate {
  let date = firstInvestmentDate.addDays(
    Math.floor(random() * investmentDateSpanDays),
  );
  while (!BusinessDayCalendar.isBusinessDay(date)) date = date.addDays(1);
  return date;
}

// Keeps the results in the order of the items.
async function mapConcurrently<T, R>(
  items: readonly T[],
  map: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const position = next++;
      results[position] = await map(items[position]);
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(CREATION_CONCURRENCY, items.length) },
      worker,
    ),
  );
  return results;
}
