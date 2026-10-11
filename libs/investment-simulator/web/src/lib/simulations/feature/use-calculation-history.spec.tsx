import { renderHook, waitFor } from '@testing-library/react';
import { fakeApi, harness } from '../../testing/simulator-harness';
import { calculationSummary } from '../../testing/simulator-fixtures';
import { useCalculationHistory } from './use-calculation-history';

const latest = calculationSummary('latest');
const past = calculationSummary('past', { outdated: true });
const month = {
  month: '2026-03',
  businessDays: 1,
  monthGrossEarnings: '5.1',
  accumulatedGrossEarnings: '217.38',
  closingGrossBalance: '10217.38',
  days: [
    {
      date: '2026-03-02',
      grossBalance: '10217.38',
      dailyGrossEarnings: '5.1',
      accumulatedGrossEarnings: '217.38',
    },
  ],
};

function api() {
  return fakeApi({
    'GET /api/investment-simulator/simulation-calculations/latest/monthly-balances':
      {
        items: [month],
      },
    'GET /api/investment-simulator/simulation-calculations/past/monthly-balances':
      {
        items: [],
      },
  });
}

describe('useCalculationHistory', () => {
  it('shows the latest calculation and loads its monthly balances', async () => {
    const fake = api();
    const { result } = renderHook(
      () => useCalculationHistory([latest, past]),
      harness(fake, '/simulacoes/sim'),
    );

    expect(result.current.selected).toBe(latest);
    expect(result.current.viewingPast).toBe(false);
    await waitFor(() =>
      expect(result.current.monthlyBalances.data?.items).toEqual([month]),
    );
    expect(fake.calls()).toEqual([
      'GET /api/investment-simulator/simulation-calculations/latest/monthly-balances',
    ]);
  });

  it('selects an earlier calculation from the URL and links back to the latest', async () => {
    const { result } = renderHook(
      () => useCalculationHistory([latest, past]),
      harness(api(), '/simulacoes/sim?calculo=past&x=1'),
    );

    expect(result.current.selected).toBe(past);
    expect(result.current.viewingPast).toBe(true);
    expect(result.current.searchFor('latest')).toBe('?x=1');
    expect(result.current.searchFor('past')).toBe('?calculo=past&x=1');
    await waitFor(() =>
      expect(result.current.monthlyBalances.data?.items).toEqual([]),
    );
  });

  it('falls back to the latest when the URL names an unknown calculation', () => {
    const { result } = renderHook(
      () => useCalculationHistory([latest, past]),
      harness(api(), '/simulacoes/sim?calculo=gone'),
    );

    expect(result.current.selected).toBe(latest);
  });

  it('reads nothing before there is a calculation', () => {
    const fake = fakeApi({});
    const { result } = renderHook(
      () => useCalculationHistory([]),
      harness(fake, '/simulacoes/nova'),
    );

    expect(result.current.selected).toBeNull();
    expect(fake.calls()).toEqual([]);
  });
});
