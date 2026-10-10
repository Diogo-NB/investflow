import { useQuery } from '@tanstack/react-query';
import { useApiFetch } from '../routes/investment-simulator-deps';
import { nonBusinessDaysQuery } from './business-calendar-api';

/**
 * Whether an ISO date is a weekend or holiday, per the API's calendar for the
 * given year. Until that year loads, no date is reported.
 */
export function useNonBusinessDays(year: number): (isoDate: string) => boolean {
  const fetchFn = useApiFetch();
  const { data } = useQuery(nonBusinessDaysQuery(fetchFn, year));
  const dates = new Set(data?.dates);
  return (isoDate) => dates.has(isoDate);
}
