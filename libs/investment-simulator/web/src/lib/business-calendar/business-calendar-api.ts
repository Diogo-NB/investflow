import { queryOptions } from '@tanstack/react-query';
import { requestJson, type FetchFn } from '../http/request-json';
import type { AcceptedYears } from './business-calendar';

export interface BusinessCalendarData {
  readonly fromYear: number;
  readonly toYear: number;
  // Holidays on weekdays; weekends are never business days.
  readonly holidays: readonly string[];
}

export const businessCalendarKeys = {
  all: ['business-calendar'] as const,
};

// The accepted years move once a year, so one read lasts the session.
export function businessCalendarQuery(
  fetchFn: FetchFn,
  { fromYear, toYear }: AcceptedYears,
) {
  return queryOptions({
    queryKey: [...businessCalendarKeys.all, fromYear, toYear] as const,
    queryFn: ({ signal }) =>
      requestJson<BusinessCalendarData>(
        fetchFn,
        `/api/investment-simulator/business-calendar?fromYear=${fromYear}&toYear=${toYear}`,
        { signal },
      ),
    staleTime: Infinity,
  });
}
