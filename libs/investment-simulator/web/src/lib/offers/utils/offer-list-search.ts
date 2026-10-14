import { pickSearch } from '../../pagination/page-search';
import type { TitleType } from '../models/offer-terms';
import type { ContentOrigin } from '../models/offer.types';

export interface OfferListFilters {
  readonly q?: string;
  readonly titleType?: TitleType;
  readonly origin?: ContentOrigin;
}

export type OfferListFilter = keyof OfferListFilters;

const TITLE_TYPES: readonly string[] = ['CDB', 'LCI', 'LCA'];
const ORIGINS: readonly string[] = ['SYSTEM', 'OWN'];

export function parseOfferListFilters(params: URLSearchParams): {
  readonly filters: OfferListFilters;
  // Parameters present with values the API would reject or ignore.
  readonly invalid: readonly OfferListFilter[];
} {
  const invalid: OfferListFilter[] = [];
  const q = params.get('q');
  const titleType = params.get('titleType');
  const validQ = q !== null && q.trim() === q && q !== '' && q.length <= 100;
  if (q !== null && !validQ) invalid.push('q');
  const validType = titleType !== null && TITLE_TYPES.includes(titleType);
  if (titleType !== null && !validType) invalid.push('titleType');
  const origin = params.get('origin');
  const validOrigin = origin !== null && ORIGINS.includes(origin);
  if (origin !== null && !validOrigin) invalid.push('origin');
  return {
    filters: {
      ...(validQ ? { q } : {}),
      ...(validType ? { titleType: titleType as TitleType } : {}),
      ...(validOrigin ? { origin: origin as ContentOrigin } : {}),
    },
    invalid,
  };
}

/** The list's own parameters, carried to an offer's pages and back. */
export function offerListSearch(params: URLSearchParams): string {
  return pickSearch(params, ['q', 'titleType', 'origin', 'page']);
}
