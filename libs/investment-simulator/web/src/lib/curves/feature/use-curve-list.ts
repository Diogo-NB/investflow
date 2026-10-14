import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { toSearch } from '../../pagination/page-search';
import { useApiFetch } from '../../routes/investment-simulator-deps';
import type { EconomicIndex } from '../../offers/models/offer-terms';
import type { ContentOrigin } from '../../offers/models/offer.types';
import { curveListQuery } from '../api/curve-api';
import type { CurveSummary } from '../models/curve.types';
import { parseCurveIndex } from '../utils/curve-list-search';

export interface CurveGroup {
  readonly index: EconomicIndex;
  readonly origin: ContentOrigin;
  readonly curves: readonly CurveSummary[];
}

export type CurveListState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly retrying: boolean }
  | {
      readonly status: 'ready';
      readonly groups: readonly CurveGroup[];
      // Another filter is loading while the previous list stays visible.
      readonly updating: boolean;
    };

// The API orders curves by index, then origin, then name, so the list splits
// into consecutive groups.
function groupCurves(curves: readonly CurveSummary[]): CurveGroup[] {
  const groups: CurveGroup[] = [];
  for (const curve of curves) {
    const last = groups.at(-1);
    if (last?.index === curve.index && last.origin === curve.origin) {
      groups[groups.length - 1] = { ...last, curves: [...last.curves, curve] };
    } else {
      groups.push({
        index: curve.index,
        origin: curve.origin,
        curves: [curve],
      });
    }
  }
  return groups;
}

export function useCurveList() {
  const fetchFn = useApiFetch();
  const [searchParams, setSearchParams] = useSearchParams();
  const { index, invalid } = parseCurveIndex(searchParams);
  const query = useQuery({
    ...curveListQuery(fetchFn, index ? { index } : {}),
    placeholderData: keepPreviousData,
  });

  const correctedSearch = (() => {
    if (!invalid) return null;
    const next = new URLSearchParams(searchParams);
    next.delete('index');
    return toSearch(next);
  })();

  const state: CurveListState = query.data
    ? {
        status: 'ready',
        groups: groupCurves(query.data),
        updating: query.isPlaceholderData,
      }
    : query.isError
      ? { status: 'error', retrying: query.isFetching }
      : { status: 'loading' };

  return {
    index,
    state,
    correctedSearch,
    search: toSearch(searchParams),
    setIndex: (next: EconomicIndex | null) => {
      const params = new URLSearchParams(searchParams);
      if (next) params.set('index', next);
      else params.delete('index');
      setSearchParams(params);
    },
    retry: () => void query.refetch(),
  };
}
