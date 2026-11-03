import { act, renderHook, waitFor } from '@testing-library/react';
import {
  apiFailure,
  fakeApi,
  harness,
  withLocation,
} from '../../../testing/simulator-harness';
import { useInvestmentSimulatorHome } from '../use-investment-simulator-home';

const API = '/api/investment-simulator';
const RECENT = `GET ${API}/simulations?page=1&pageSize=5`;
const BEST = `GET ${API}/simulations?page=1&pageSize=1&sort=netAnnualReturn`;
const ACTION_REQUIRED = `GET ${API}/simulations?page=1&pageSize=1&calculationStatus=INVALID`;
const PLANS = `GET ${API}/investment-plans?page=1&pageSize=3`;

const FIRST_ID = '6f1c1d2e-0b3a-4c5d-8e9f-0a1b2c3d4e5f';
const SECOND_ID = '7a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

const calculated = {
  id: FIRST_ID,
  offerName: null,
  principal: '10000',
  investmentDate: '2026-01-02',
  maturityDate: '2027-01-04',
  titleType: 'CDB',
  issuerName: 'Banco Local',
  remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1.1' },
  calculationStatus: 'CALCULATED',
  isSettled: true,
  result: {
    calculatedAt: '2026-10-10T12:00:00.000Z',
    netBalance: '11028.00',
    netAnnualReturn: '0.1028',
  },
};

const withoutResult = {
  ...calculated,
  id: SECOND_ID,
  calculationStatus: 'INVALID',
  isSettled: false,
  result: null,
};

const plan = {
  id: '0b6a3c9e-2f4d-4a51-9d1e-7c8b5a6f3e21',
  name: 'Reserva',
  description: null,
  simulationCount: 1,
  availableSimulationSlots: 49,
  status: {
    calculatingCount: 0,
    pendingIssueCount: 0,
    outdatedResultCount: 0,
  },
};

const page = <T,>(items: readonly T[], total = items.length) => ({
  items,
  total,
  page: 1,
  pageSize: items.length || 1,
});

function homeApi(overrides: Record<string, unknown> = {}) {
  return fakeApi({
    [RECENT]: page([calculated, withoutResult], 12),
    [BEST]: page([calculated], 12),
    [ACTION_REQUIRED]: page([withoutResult], 2),
    [PLANS]: page([plan], 4),
    ...overrides,
  });
}

function render(api: ReturnType<typeof fakeApi>, entry = '/') {
  return renderHook(
    withLocation(useInvestmentSimulatorHome),
    harness(api, entry),
  );
}

describe('useInvestmentSimulatorHome', () => {
  it('reads the recent simulations, the best result, the count requiring action, and the plans', async () => {
    const { result } = render(homeApi());

    await waitFor(() => {
      const home = result.current.hook;
      expect(home.recent).toEqual({
        status: 'ready',
        data: { items: [calculated, withoutResult], total: 12 },
      });
      expect(home.best).toEqual({ status: 'ready', data: calculated });
      expect(home.actionRequiredCount).toEqual({ status: 'ready', data: 2 });
      expect(home.plans).toEqual({
        status: 'ready',
        data: { items: [plan], total: 4 },
      });
    });
  });

  it('has no best result while no simulation has a result', async () => {
    const { result } = render(homeApi({ [BEST]: page([withoutResult]) }));

    await waitFor(() =>
      expect(result.current.hook.best).toEqual({ status: 'ready', data: null }),
    );
  });

  it('retries each failed read on its own', async () => {
    let attempts = 0;
    const { result } = render(
      homeApi({
        [RECENT]: () =>
          ++attempts === 1
            ? apiFailure(500, 'SIMULATION_QUERY_FAILED')()
            : page([calculated]),
      }),
    );

    await waitFor(() =>
      expect(result.current.hook.recent.status).toBe('error'),
    );
    expect(result.current.hook.plans.status).toBe('ready');

    act(() => result.current.hook.retryRecent());
    await waitFor(() =>
      expect(result.current.hook.recent.status).toBe('ready'),
    );
  });

  it('selects simulations to compare in the URL, carrying them to the list', async () => {
    const { result } = render(homeApi());

    act(() => result.current.hook.toggleSelected(FIRST_ID));
    expect(result.current.hook.comparisonPath).toBeNull();

    act(() => result.current.hook.toggleSelected(SECOND_ID));
    expect(result.current.location.search).toBe(
      `?comparar=${FIRST_ID}%2C${SECOND_ID}`,
    );
    expect(result.current.hook.comparisonPath).toBe(
      `/simulacoes/comparar?ids=${FIRST_ID}%2C${SECOND_ID}`,
    );
    expect(result.current.hook.simulationListPath).toBe(
      `/simulacoes?comparar=${FIRST_ID}%2C${SECOND_ID}`,
    );

    act(() => result.current.hook.clearSelection());
    expect(result.current.location.search).toBe('');
  });

  it('corrects a malformed selection', () => {
    const { result } = render(homeApi(), `/?comparar=${FIRST_ID},x`);

    expect(result.current.hook.correctedSearch).toBe(`?comparar=${FIRST_ID}`);
  });
});
