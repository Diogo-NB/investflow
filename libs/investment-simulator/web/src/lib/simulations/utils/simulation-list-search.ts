import { pickSearch, toSearch } from '../../pagination/page-search';
import type {
  RemunerationKind,
  TitleType,
} from '../../offers/models/offer-terms';
import type { CalculationStatus } from '../models/simulation.types';
import {
  MAX_COMPARED,
  parseSimulationIds,
} from './simulation-comparison-search';

export interface SimulationListFilters {
  // Part of the offer's name or issuer.
  readonly q?: string;
  readonly offerId?: string;
  readonly curveId?: string;
  readonly titleType?: TitleType;
  readonly remunerationKind?: RemunerationKind;
  readonly calculationStatus?: CalculationStatus;
}

export type SimulationListFilter = keyof SimulationListFilters;

// Newest first when absent.
export type SimulationListSort = 'netAnnualReturn';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The URL uses the API's parameter names and values.
const FILTER_VALUES: Record<SimulationListFilter, (value: string) => boolean> =
  {
    q: (value) => value !== '' && value.trim() === value && value.length <= 100,
    offerId: (value) => UUID.test(value),
    curveId: (value) => UUID.test(value),
    titleType: (value) => ['CDB', 'LCI', 'LCA'].includes(value),
    remunerationKind: (value) =>
      ['PREFIXED', 'CDI_PERCENTAGE', 'SELIC_PERCENTAGE', 'IPCA_PLUS'].includes(
        value,
      ),
    calculationStatus: (value) =>
      ['PENDING', 'CALCULATED', 'INVALID', 'FAILED'].includes(value),
  };

export const LIST_FILTERS = Object.keys(
  FILTER_VALUES,
) as readonly SimulationListFilter[];

/** The valid filters, and the names of those present with invalid values. */
export function parseFilters(params: URLSearchParams): {
  readonly filters: SimulationListFilters;
  readonly invalid: readonly SimulationListFilter[];
} {
  const filters: Record<string, string> = {};
  const invalid: SimulationListFilter[] = [];
  for (const name of LIST_FILTERS) {
    const value = params.get(name);
    if (value === null) continue;
    if (FILTER_VALUES[name](value)) filters[name] = value;
    else invalid.push(name);
  }
  return { filters, invalid };
}

/** The sort, and whether the URL holds an invalid one. */
export function parseSort(params: URLSearchParams): {
  readonly sort: SimulationListSort | undefined;
  readonly invalid: boolean;
} {
  const value = params.get('sort');
  if (value === null) return { sort: undefined, invalid: false };
  return value === 'netAnnualReturn'
    ? { sort: value, invalid: false }
    : { sort: undefined, invalid: true };
}

/** The simulations selected for comparison, kept across filters and pages. */
export function parseSelection(params: URLSearchParams) {
  return parseSimulationIds(params.get('comparar'));
}

/** The list's own parameters, carried to a simulation and back to the list. */
export function listSearch(params: URLSearchParams): string {
  return pickSearch(params, [...LIST_FILTERS, 'sort', 'page', 'comparar']);
}

/**
 * The list search with this simulation selected for comparison. At the limit
 * it takes the place of the last one selected.
 */
export function listSearchSelecting(params: URLSearchParams, id: string) {
  const next = new URLSearchParams(listSearch(params));
  const { ids } = parseSelection(next);
  const selected = ids.includes(id) ? ids : [id, ...ids].slice(0, MAX_COMPARED);
  next.set('comparar', selected.join(','));
  return toSearch(next);
}
