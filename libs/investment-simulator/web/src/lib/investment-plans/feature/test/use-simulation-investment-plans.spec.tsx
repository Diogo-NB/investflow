import { act, renderHook, waitFor } from '@testing-library/react';
import {
  apiFailure,
  fakeApi,
  harness,
} from '../../../testing/simulator-harness';
import type { InvestmentPlanListItem } from '../../models/investment-plan.types';
import {
  useSimulationInvestmentPlanPicker,
  useSimulationInvestmentPlans,
} from '../use-simulation-investment-plans';
import { API, page, plan, settled } from './fixtures';

const membershipsUrl = `GET ${API}/investment-plans?page=1&pageSize=100&simulationId=sim`;
const pickerUrl = (n: number) =>
  `GET ${API}/investment-plans?page=${n}&pageSize=20`;
const addUrl = (id: string) => `POST ${API}/investment-plans/${id}/simulations`;

function listed(
  id: string,
  overrides: Partial<InvestmentPlanListItem> = {},
): InvestmentPlanListItem {
  return {
    id,
    name: `Plano ${id}`,
    description: null,
    simulationCount: 2,
    availableSimulationSlots: 48,
    status: settled,
    ...overrides,
  };
}

describe('useSimulationInvestmentPlans', () => {
  it('lists the plans the simulation belongs to, with their total', async () => {
    const { result } = renderHook(
      () => useSimulationInvestmentPlans('sim'),
      harness(fakeApi({ [membershipsUrl]: page([listed('a')], 1) })),
    );

    expect(result.current.state.status).toBe('loading');
    await waitFor(() =>
      expect(result.current.state).toEqual({
        status: 'ready',
        items: [listed('a')],
        total: 1,
      }),
    );
  });

  it('retries a failed read', async () => {
    let fail = true;
    const { result } = renderHook(
      () => useSimulationInvestmentPlans('sim'),
      harness(
        fakeApi({
          [membershipsUrl]: () =>
            fail
              ? apiFailure(500, 'INVESTMENT_PLAN_QUERY_FAILED')()
              : page([], 0),
        }),
      ),
    );
    await waitFor(() => expect(result.current.state.status).toBe('error'));

    fail = false;
    act(() => result.current.retry());

    await waitFor(() =>
      expect(result.current.state).toMatchObject({ status: 'ready', total: 0 }),
    );
  });
});

describe('useSimulationInvestmentPlanPicker', () => {
  function render(api: ReturnType<typeof fakeApi>) {
    return renderHook(
      () => ({
        picker: useSimulationInvestmentPlanPicker({
          simulationId: 'sim',
          memberIds: ['a'],
        }),
        memberships: useSimulationInvestmentPlans('sim'),
      }),
      harness(api),
    );
  }

  it("pages through the owner's plans, members and full plans marked", async () => {
    const full = listed('c', { availableSimulationSlots: 0 });
    const { result } = render(
      fakeApi({
        [membershipsUrl]: page([listed('a')], 1),
        [pickerUrl(1)]: page([listed('a'), listed('b'), full], 21),
        [pickerUrl(2)]: page([listed('z')], 21),
      }),
    );

    await waitFor(() =>
      expect(result.current.picker.state).toMatchObject({
        status: 'ready',
        total: 21,
        lastPage: 2,
      }),
    );
    const { picker } = result.current;
    expect(picker.isMember(listed('a'))).toBe(true);
    expect(picker.isMember(listed('b'))).toBe(false);
    expect(picker.isFull(full)).toBe(true);
    expect(picker.isFull(listed('b'))).toBe(false);

    act(() => result.current.picker.setPage(2));
    await waitFor(() =>
      expect(result.current.picker.state).toMatchObject({
        items: [listed('z')],
        updating: false,
      }),
    );
  });

  it('adds the simulation once and refreshes its plans', async () => {
    let added = false;
    const api = fakeApi({
      [membershipsUrl]: () =>
        page(added ? [listed('a'), listed('b')] : [listed('a')]),
      [pickerUrl(1)]: page([listed('a'), listed('b')]),
      [addUrl('b')]: () => {
        added = true;
        return undefined;
      },
    });
    const { result } = render(api);
    await waitFor(() =>
      expect(result.current.picker.state.status).toBe('ready'),
    );

    act(() => result.current.picker.add(listed('b')));
    act(() => result.current.picker.add(listed('b')));

    await waitFor(() => expect(result.current.picker.addedPlan?.id).toBe('b'));
    expect(api.bodies(addUrl('b'))).toEqual([{ simulationIds: ['sim'] }]);
    await waitFor(() =>
      expect(result.current.memberships.state).toMatchObject({ total: 2 }),
    );
    expect(result.current.picker.problem).toBeNull();
  });

  it('names the plan when an add fails', async () => {
    const { result } = render(
      fakeApi({
        [membershipsUrl]: page([]),
        [pickerUrl(1)]: page([listed('b')]),
        [addUrl('b')]: apiFailure(422, 'INVESTMENT_PLAN_SIMULATION_LIMIT'),
      }),
    );
    await waitFor(() =>
      expect(result.current.picker.state.status).toBe('ready'),
    );

    act(() => result.current.picker.add(listed('b')));

    await waitFor(() =>
      expect(result.current.picker.problem).toBe(
        'Não foi possível adicionar ao plano Plano b. Mensagem de INVESTMENT_PLAN_SIMULATION_LIMIT.',
      ),
    );
    expect(result.current.picker.pendingPlanId).toBeNull();
    expect(result.current.picker.addedPlan).toBeNull();
  });

  it('keeps a failed list retryable', async () => {
    let fail = true;
    const { result } = render(
      fakeApi({
        [membershipsUrl]: page([]),
        [pickerUrl(1)]: () =>
          fail
            ? apiFailure(500, 'INVESTMENT_PLAN_QUERY_FAILED')()
            : page([plan]),
      }),
    );
    await waitFor(() =>
      expect(result.current.picker.state.status).toBe('error'),
    );

    fail = false;
    act(() => result.current.picker.retry());

    await waitFor(() =>
      expect(result.current.picker.state).toMatchObject({ status: 'ready' }),
    );
  });
});
