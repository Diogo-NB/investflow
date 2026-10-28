import { act, renderHook, waitFor } from '@testing-library/react';
import {
  apiFailure,
  fakeApi,
  harness,
} from '../../../testing/simulator-harness';
import { useAddInvestmentPlanSimulations } from '../use-add-investment-plan-simulations';
import { API, page, PLAN_URL, PLAN_ID, simulation } from './fixtures';

const pickerUrl = (n: number) => `GET ${API}/simulations?page=${n}&pageSize=20`;

function render(
  api: ReturnType<typeof fakeApi>,
  { availableSlots = 48, onAdded = vi.fn() } = {},
) {
  return renderHook(
    () =>
      useAddInvestmentPlanSimulations({
        investmentPlanId: PLAN_ID,
        memberIds: ['a'],
        availableSlots,
        onAdded,
      }),
    harness(api),
  );
}

describe('useAddInvestmentPlanSimulations', () => {
  it("pages through the owner's simulations, members marked", async () => {
    const api = fakeApi({
      [pickerUrl(1)]: page([simulation('a'), simulation('b')], 25),
      [pickerUrl(2)]: page([simulation('z')], 25),
    });
    const { result } = render(api);

    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        status: 'ready',
        total: 25,
        lastPage: 2,
      }),
    );
    expect(result.current.isMember('a')).toBe(true);
    expect(result.current.isMember('b')).toBe(false);

    act(() => result.current.setPage(2));
    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        items: [simulation('z')],
        updating: false,
      }),
    );
  });

  it('filters, searches, and sorts from the first page, keeping the choice', async () => {
    const filtered = `${pickerUrl(1)}&titleType=LCI&q=Banco+X`;
    const api = fakeApi({
      [pickerUrl(1)]: page([simulation('b')], 25),
      [pickerUrl(2)]: page([simulation('z')], 25),
      [filtered]: page([], 0),
      [`${filtered}&sort=netAnnualReturn`]: page([simulation('c')]),
      [`${pickerUrl(1)}&q=Banco+X`]: page([simulation('c')]),
    });
    const { result } = render(api);
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    act(() => result.current.toggle('b'));
    act(() => result.current.setPage(2));

    act(() => {
      result.current.setFilter('titleType', 'LCI');
      result.current.setFilter('q', 'Banco X');
    });

    expect(result.current.page).toBe(1);
    expect(result.current.filtered).toBe(true);
    await waitFor(() =>
      expect(result.current.state).toMatchObject({ total: 0, updating: false }),
    );
    act(() => result.current.setSort('netAnnualReturn'));
    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        items: [simulation('c')],
        updating: false,
      }),
    );
    act(() => {
      result.current.setSort(null);
      result.current.setFilter('titleType', null);
    });
    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        items: [simulation('c')],
        updating: false,
      }),
    );
    expect(result.current.filters).toEqual({ q: 'Banco X' });
    act(() => result.current.clearFilters());
    expect(result.current.filtered).toBe(false);
    expect(result.current.chosen).toEqual(['b']);
  });

  it('chooses no more than the free slots', async () => {
    const { result } = render(fakeApi({ [pickerUrl(1)]: page([]) }), {
      availableSlots: 2,
    });

    act(() => result.current.toggle('b'));
    act(() => result.current.toggle('c'));
    act(() => result.current.toggle('d'));

    expect(result.current.chosen).toEqual(['b', 'c']);
    expect(result.current.canChooseMore).toBe(false);
    act(() => result.current.toggle('b'));
    expect(result.current.chosen).toEqual(['c']);
  });

  it('adds the chosen simulations in one request', async () => {
    const onAdded = vi.fn();
    const api = fakeApi({
      [pickerUrl(1)]: page([]),
      [`POST ${PLAN_URL}/simulations`]: undefined,
    });
    const { result } = render(api, { onAdded });
    act(() => result.current.toggle('b'));
    act(() => result.current.toggle('c'));

    act(() => {
      result.current.submit();
      result.current.submit();
    });

    await waitFor(() => expect(onAdded).toHaveBeenCalledTimes(1));
    expect(api.bodies(`POST ${PLAN_URL}/simulations`)).toEqual([
      { simulationIds: ['b', 'c'] },
    ]);
  });

  it("keeps the choice and shows the API's reason when the add fails", async () => {
    const onAdded = vi.fn();
    const api = fakeApi({
      [pickerUrl(1)]: page([]),
      [`POST ${PLAN_URL}/simulations`]: apiFailure(
        409,
        'INVESTMENT_PLAN_SIMULATION_LIMIT',
      ),
    });
    const { result } = render(api, { onAdded });
    act(() => result.current.toggle('b'));

    act(() => result.current.submit());

    await waitFor(() =>
      expect(result.current.problem).toBe(
        'Mensagem de INVESTMENT_PLAN_SIMULATION_LIMIT.',
      ),
    );
    expect(result.current.chosen).toEqual(['b']);
    expect(onAdded).not.toHaveBeenCalled();
  });

  it('retries a failed read', async () => {
    let attempts = 0;
    const api = fakeApi({
      [pickerUrl(1)]: () =>
        ++attempts === 1
          ? apiFailure(500, 'SIMULATION_QUERY_FAILED')()
          : page([]),
    });
    const { result } = render(api);

    await waitFor(() => expect(result.current.state.status).toBe('error'));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
  });
});
