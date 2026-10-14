import { useQuery } from '@tanstack/react-query';
import { todayInSaoPaulo } from '../dates/calendar-date';
import { useApiFetch } from '../routes/investment-simulator-deps';
import {
  acceptedYears,
  businessCalendar,
  type BusinessCalendar,
} from './business-calendar';
import { businessCalendarQuery } from './business-calendar-api';

export type BusinessCalendarState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly retrying: boolean }
  | { readonly status: 'ready'; readonly calendar: BusinessCalendar };

/** The business calendar, read once per session and prefetched at startup. */
export function useBusinessCalendar() {
  const fetchFn = useApiFetch();
  const query = useQuery({
    ...businessCalendarQuery(fetchFn, acceptedYears(todayInSaoPaulo())),
    // Built once per read, not per render.
    select: businessCalendar,
  });
  const state: BusinessCalendarState = query.data
    ? { status: 'ready', calendar: query.data }
    : query.isError
      ? { status: 'error', retrying: query.isFetching }
      : { status: 'loading' };
  return { state, retry: () => void query.refetch() };
}
