import { act, renderHook, waitFor } from '@testing-library/react';
import {
  apiFailure,
  fakeApi,
  harness,
} from '../../../testing/simulator-harness';
import { useInvestmentPlanList } from '../use-investment-plan-list';
import { API, page, plan, settled } from './fixtures';

const listUrl = (n: number) =>
  `GET ${API}/investment-plans?page=${n}&pageSize=20`;

const listed = {
  id: plan.id,
  name: plan.name,
  description: null,
  simulationCount: 2,
  availableSimulationSlots: 48,
  status: settled,
};

function render(api: ReturnType<typeof fakeApi>, entry = '/planos') {
  return renderHook(() => useInvestmentPlanList(), harness(api, entry));
}

describe('useInvestmentPlanList', () => {
  it('reads a page of plans', async () => {
    const { result } = render(fakeApi({ [listUrl(1)]: page([listed], 21) }));

    await waitFor(() =>
      expect(result.current.state).toEqual({
        status: 'ready',
        items: [listed],
        total: 21,
        lastPage: 2,
        updating: false,
      }),
    );
  });

  it('reads an empty list', async () => {
    const { result } = render(fakeApi({ [listUrl(1)]: page([]) }));

    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        status: 'ready',
        items: [],
        total: 0,
      }),
    );
  });

  it('retries a failed read', async () => {
    let attempts = 0;
    const api = fakeApi({
      [listUrl(1)]: () =>
        ++attempts === 1
          ? apiFailure(500, 'INVESTMENT_PLAN_QUERY_FAILED')()
          : page([listed]),
    });
    const { result } = render(api);

    await waitFor(() => expect(result.current.state.status).toBe('error'));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
  });

  it('corrects a malformed page and one past the end', async () => {
    const malformed = render(
      fakeApi({ [listUrl(1)]: page([]) }),
      '/planos?page=x',
    );
    expect(malformed.result.current.correctedSearch).toBe('');

    const past = render(
      fakeApi({ [listUrl(3)]: page([], 21) }),
      '/planos?page=3',
    );
    await waitFor(() =>
      expect(past.result.current.correctedSearch).toBe('?page=2'),
    );
  });
});
