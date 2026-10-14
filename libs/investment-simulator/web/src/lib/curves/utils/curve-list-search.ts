import { pickSearch } from '../../pagination/page-search';
import type { EconomicIndex } from '../../offers/models/offer-terms';
import { INDEXES } from '../models/curve-terms';

export function parseCurveIndex(params: URLSearchParams): {
  readonly index: EconomicIndex | undefined;
  // Present with a value the API would reject.
  readonly invalid: boolean;
} {
  const index = params.get('index');
  if (index === null) return { index: undefined, invalid: false };
  return INDEXES.includes(index as EconomicIndex)
    ? { index: index as EconomicIndex, invalid: false }
    : { index: undefined, invalid: true };
}

/** The list's own parameters, carried to a curve's pages and back. */
export function curveListSearch(params: URLSearchParams): string {
  return pickSearch(params, ['index']);
}
