import { act, renderHook, waitFor } from '@testing-library/react';
import {
  apiFailure,
  fakeApi,
  harness,
  withLocation,
} from '../../../testing/simulator-harness';
import { useInvestmentPlanDetails } from '../use-investment-plan-details';
import { API, page, plan, PLAN_ID, PLAN_URL, simulation } from './fixtures';

const membersUrl = `GET ${API}/simulations?page=1&pageSize=100&investmentPlanId=${PLAN_ID}`;
const members = [simulation('a'), simulation('b'), simulation('c')];

const routes = {
  [`GET ${PLAN_URL}`]: plan,
  [membersUrl]: page(members),
};

function render(api: ReturnType<typeof fakeApi>, entry = `/planos/${PLAN_ID}`) {
  return renderHook(
    withLocation(() => useInvestmentPlanDetails(PLAN_ID)),
    harness(api, entry),
  );
}

describe('useInvestmentPlanDetails', () => {
  it('reads the plan and all its members', async () => {
    const { result } = render(fakeApi(routes));

    await waitFor(() =>
      expect(result.current.hook.state).toEqual({ status: 'ready', plan }),
    );
    await waitFor(() =>
      expect(result.current.hook.members.state).toEqual({
        status: 'ready',
        items: members,
        updating: false,
      }),
    );
    expect(result.current.hook.members.ids).toEqual(['a', 'b', 'c']);
  });

  it('orders the members as the URL asks and drops an unknown order', async () => {
    const api = fakeApi({
      ...routes,
      [`${membersUrl}&sort=netAnnualReturn`]: page([members[2]]),
    });
    const { result } = render(api, `/planos/${PLAN_ID}?sort=netAnnualReturn`);
    await waitFor(() =>
      expect(result.current.hook.members.state).toMatchObject({
        items: [members[2]],
      }),
    );

    act(() => result.current.hook.setSort(null));
    await waitFor(() => expect(result.current.location.search).toBe(''));

    const invalid = render(fakeApi(routes), `/planos/${PLAN_ID}?sort=x&a=1`);
    expect(invalid.result.current.hook.correctedSearch).toBe('?a=1');
  });

  it('reports a missing plan separately from a failed read', async () => {
    const missing = render(
      fakeApi({
        ...routes,
        [`GET ${PLAN_URL}`]: apiFailure(404, 'INVESTMENT_PLAN_NOT_FOUND'),
      }),
    );
    await waitFor(() =>
      expect(missing.result.current.hook.state.status).toBe('missing'),
    );

    const failed = render(
      fakeApi({
        ...routes,
        [`GET ${PLAN_URL}`]: apiFailure(500, 'INVESTMENT_PLAN_QUERY_FAILED'),
      }),
    );
    await waitFor(() =>
      expect(failed.result.current.hook.state.status).toBe('error'),
    );
  });

  it('selects between two and six members to compare', async () => {
    const { result } = render(fakeApi(routes));
    await waitFor(() => expect(result.current.hook.state.status).toBe('ready'));

    act(() => result.current.hook.selection.toggle('a'));
    expect(result.current.hook.selection.comparisonPath).toBeNull();
    act(() => result.current.hook.selection.toggle('b'));
    expect(result.current.hook.selection.comparisonPath).toBe(
      '/simulacoes/comparar?ids=a%2Cb',
    );
    act(() => result.current.hook.selection.toggle('a'));
    expect(result.current.hook.selection.selected).toEqual(['b']);
  });

  it('removes one member at a time and reads the plan again', async () => {
    let removed = false;
    const api = fakeApi({
      [`GET ${PLAN_URL}`]: () =>
        removed ? { ...plan, simulationCount: 2 } : plan,
      [membersUrl]: () => page(removed ? members.slice(1) : members),
      [`DELETE ${PLAN_URL}/simulations/a`]: () => {
        removed = true;
        return undefined;
      },
    });
    const { result } = render(api);
    await waitFor(() =>
      expect(result.current.hook.members.ids).toHaveLength(3),
    );
    act(() => result.current.hook.selection.toggle('a'));

    act(() => {
      result.current.hook.removeMember.run('a');
      result.current.hook.removeMember.run('b');
    });
    expect(result.current.hook.removeMember.removingId).toBe('a');

    await waitFor(() =>
      expect(result.current.hook.members.ids).toEqual(['b', 'c']),
    );
    expect(result.current.hook.removeMember.removingId).toBeNull();
    expect(result.current.hook.selection.selected).toEqual([]);
    expect(api.calls().filter((call) => call.startsWith('DELETE'))).toEqual([
      `DELETE ${PLAN_URL}/simulations/a`,
    ]);
  });

  it('says which member could not be removed', async () => {
    const api = fakeApi({
      ...routes,
      [`DELETE ${PLAN_URL}/simulations/b`]: apiFailure(
        500,
        'REPOSITORY_SAVE_FAILED',
      ),
    });
    const { result } = render(api);
    await waitFor(() =>
      expect(result.current.hook.members.ids).toHaveLength(3),
    );

    act(() => result.current.hook.removeMember.run('b'));

    await waitFor(() =>
      expect(result.current.hook.removeMember.failedId).toBe('b'),
    );
    expect(result.current.hook.removeMember.removingId).toBeNull();
  });

  it('deletes the plan and returns to the list', async () => {
    const api = fakeApi({ ...routes, [`DELETE ${PLAN_URL}`]: undefined });
    const { result } = render(api);
    await waitFor(() => expect(result.current.hook.state.status).toBe('ready'));

    act(() => {
      result.current.hook.remove.run();
      result.current.hook.remove.run();
    });

    await waitFor(() =>
      expect(result.current.location.pathname).toBe('/planos'),
    );
    expect(
      api.calls().filter((call) => call.startsWith('DELETE')),
    ).toHaveLength(1);
  });
});
