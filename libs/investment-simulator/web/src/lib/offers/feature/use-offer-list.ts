import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { parsePage, toSearch, withPage } from '../../pagination/page-search';
import { useApiFetch } from '../../routes/investment-simulator-deps';
import { offerListQuery } from '../api/offer-api';
import type { ContentOrigin, OfferSummary } from '../models/offer.types';
import type { TitleType } from '../models/offer-terms';
import {
  parseOfferListFilters,
  type OfferListFilter,
} from '../utils/offer-list-search';

export interface OfferGroup {
  readonly titleType: TitleType;
  readonly origin: ContentOrigin;
  readonly offers: readonly OfferSummary[];
}

export type OfferListState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly retrying: boolean }
  | {
      readonly status: 'ready';
      readonly groups: readonly OfferGroup[];
      readonly total: number;
      readonly lastPage: number;
      // A newer page is loading while the previous one stays visible.
      readonly updating: boolean;
    };

// The API orders offers by title type, then origin, so a page splits into
// consecutive groups.
function groupOffers(offers: readonly OfferSummary[]): OfferGroup[] {
  const groups: OfferGroup[] = [];
  for (const offer of offers) {
    const last = groups.at(-1);
    if (last?.titleType === offer.titleType && last.origin === offer.origin) {
      groups[groups.length - 1] = { ...last, offers: [...last.offers, offer] };
    } else {
      groups.push({
        titleType: offer.titleType,
        origin: offer.origin,
        offers: [offer],
      });
    }
  }
  return groups;
}

export function useOfferList() {
  const fetchFn = useApiFetch();
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, invalid } = parseOfferListFilters(searchParams);
  const requested = parsePage(searchParams.get('page'));
  const page = requested ?? 1;
  const query = useQuery({
    ...offerListQuery(fetchFn, { page, ...filters }),
    placeholderData: keepPreviousData,
  });

  const lastPage = query.data
    ? Math.max(1, Math.ceil(query.data.total / query.data.pageSize))
    : null;
  const correctedPage =
    requested === null
      ? 1
      : lastPage !== null && !query.isPlaceholderData && page > lastPage
        ? lastPage
        : null;
  const correctedSearch = (() => {
    if (invalid.length === 0 && correctedPage === null) return null;
    const next = new URLSearchParams(searchParams);
    for (const name of invalid) next.delete(name);
    return withPage(next, correctedPage ?? page);
  })();

  const state: OfferListState =
    query.data && lastPage !== null
      ? {
          status: 'ready',
          groups: groupOffers(query.data.items),
          total: query.data.total,
          lastPage,
          updating: query.isPlaceholderData,
        }
      : query.isError
        ? { status: 'error', retrying: query.isFetching }
        : { status: 'loading' };

  // Another search or filter is another list, which starts at its first page.
  function updateFilter(name: OfferListFilter, value: string) {
    const next = new URLSearchParams(searchParams);
    const trimmed = value.trim().slice(0, 100);
    if (trimmed) next.set(name, trimmed);
    else next.delete(name);
    next.delete('page');
    setSearchParams(next);
  }

  return {
    page,
    filters,
    filtered: Object.keys(filters).length > 0,
    state,
    correctedSearch,
    search: toSearch(searchParams),
    submitSearch: (q: string) => updateFilter('q', q),
    setTitleType: (titleType: TitleType | null) =>
      updateFilter('titleType', titleType ?? ''),
    setOrigin: (origin: ContentOrigin | null) =>
      updateFilter('origin', origin ?? ''),
    retry: () => void query.refetch(),
  };
}
