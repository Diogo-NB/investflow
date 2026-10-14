import type { QueryClient } from '@tanstack/react-query';
import { acceptedYears } from '../business-calendar/business-calendar';
import { businessCalendarQuery } from '../business-calendar/business-calendar-api';
import { todayInSaoPaulo } from '../dates/calendar-date';
import type { InvestmentSimulatorDeps } from './investment-simulator-deps';

/**
 * Starts the reads every screen of the context needs, so they are ready by
 * the time one opens. A failure is left to the screens, which retry it.
 */
export function prefetchInvestmentSimulator(
  queryClient: QueryClient,
  deps: InvestmentSimulatorDeps,
): void {
  void queryClient.prefetchQuery(
    businessCalendarQuery(deps.fetch, acceptedYears(todayInSaoPaulo())),
  );
}
