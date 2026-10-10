import { queryOptions } from '@tanstack/react-query';
import { requestJson, type FetchFn } from '../http/request-json';

export const businessCalendarKeys = {
  all: ['business-calendar'] as const,
  nonBusinessDays: (year: number) =>
    [...businessCalendarKeys.all, 'non-business-days', year] as const,
};

// A year's calendar never changes, so it is read once per session.
export function nonBusinessDaysQuery(fetchFn: FetchFn, year: number) {
  return queryOptions({
    queryKey: businessCalendarKeys.nonBusinessDays(year),
    queryFn: ({ signal }) =>
      requestJson<{ year: number; dates: string[] }>(
        fetchFn,
        `/api/investment-simulator/business-calendar/non-business-days?year=${year}`,
        { signal },
      ),
    staleTime: Infinity,
  });
}
