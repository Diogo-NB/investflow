import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { useApiFetch } from '../../routes/investment-simulator-deps';
import { monthlyBalancesQuery } from '../api/simulation-api';
import type { CalculationSummary } from '../models/simulation.types';

export const CALCULATION_PARAM = 'calculo';

export function useCalculationHistory(
  calculations: readonly CalculationSummary[],
) {
  const fetchFn = useApiFetch();
  const [searchParams] = useSearchParams();
  const latest = calculations[0] ?? null;
  const requested = searchParams.get(CALCULATION_PARAM);
  const selected = calculations.find((item) => item.id === requested) ?? latest;
  const monthlyBalances = useQuery({
    ...monthlyBalancesQuery(fetchFn, selected?.id ?? ''),
    enabled: selected !== null,
  });

  /** Search string that shows a calculation, keeping unrelated parameters. */
  function searchFor(calculationId: string): string {
    const next = new URLSearchParams(searchParams);
    if (calculationId === latest?.id) next.delete(CALCULATION_PARAM);
    else next.set(CALCULATION_PARAM, calculationId);
    const search = next.toString();
    return search ? `?${search}` : '';
  }

  return {
    items: calculations,
    latest,
    selected,
    viewingPast: selected !== null && selected !== latest,
    monthlyBalances,
    searchFor,
  };
}
