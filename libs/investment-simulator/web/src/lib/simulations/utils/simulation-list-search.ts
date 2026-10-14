import { pickSearch } from '../../pagination/page-search';
import type {
  RemunerationKind,
  TitleType,
} from '../../offers/models/offer-terms';
import type { CalculationStatus } from '../models/simulation.types';

export interface SimulationListFilters {
  readonly offerId?: string;
  readonly curveId?: string;
  readonly titleType?: TitleType;
  readonly remunerationKind?: RemunerationKind;
  readonly calculationStatus?: CalculationStatus;
}

export type SimulationListFilter = keyof SimulationListFilters;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The URL uses the API's parameter names and values.
const FILTER_VALUES: Record<SimulationListFilter, (value: string) => boolean> =
  {
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

/** The list's own parameters, carried to a simulation and back to the list. */
export function listSearch(params: URLSearchParams): string {
  return pickSearch(params, [...LIST_FILTERS, 'page']);
}
