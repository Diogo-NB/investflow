import { act, renderHook, waitFor } from '@testing-library/react';
import {
  apiFailure,
  fakeApi,
  harness,
  withLocation,
} from '../../../testing/simulator-harness';
import { useInvestmentPlanEditor } from '../use-investment-plan-editor';
import { API, plan, PLAN_ID, PLAN_URL } from './fixtures';

function render(api: ReturnType<typeof fakeApi>, id: string | undefined) {
  return renderHook(
    withLocation(() => useInvestmentPlanEditor(id)),
    harness(api, id ? `/planos/${id}/editar` : '/planos/novo'),
  );
}

describe('useInvestmentPlanEditor', () => {
  it('creates one plan per submission and opens it', async () => {
    const api = fakeApi({
      [`POST ${API}/investment-plans`]: { investmentPlanId: 'created' },
    });
    const { result } = render(api, undefined);
    expect(result.current.hook.setup).toMatchObject({
      status: 'ready',
      plan: null,
      initialValues: { name: '', description: '' },
    });

    act(() => {
      result.current.hook.save.create({ name: ' Reserva ', description: ' ' });
      result.current.hook.save.create({ name: 'Reserva', description: '' });
    });

    await waitFor(() =>
      expect(result.current.location.pathname).toBe('/planos/created'),
    );
    expect(api.bodies(`POST ${API}/investment-plans`)).toEqual([
      { name: 'Reserva', description: null },
    ]);
  });

  it('starts from the saved plan and sends only what changed, with its revision', async () => {
    const api = fakeApi({
      [`GET ${PLAN_URL}`]: { ...plan, description: 'Curto prazo' },
      [`PATCH ${PLAN_URL}`]: { revision: 4 },
    });
    const { result } = render(api, PLAN_ID);
    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));
    const { setup } = result.current.hook;
    if (setup.status !== 'ready' || !setup.plan) throw new Error('not ready');
    expect(setup.initialValues).toEqual({
      name: 'Reserva',
      description: 'Curto prazo',
    });

    act(() =>
      result.current.hook.save.edit(setup.plan, {
        name: 'Reserva',
        description: '',
      }),
    );

    await waitFor(() =>
      expect(result.current.location.pathname).toBe(`/planos/${PLAN_ID}`),
    );
    expect(api.bodies(`PATCH ${PLAN_URL}`)).toEqual([
      { revision: 3, description: null },
    ]);
  });

  it('reports a conflict and reloads the saved version', async () => {
    let reads = 0;
    const api = fakeApi({
      [`GET ${PLAN_URL}`]: () => ({ ...plan, revision: 3 + reads++ }),
      [`PATCH ${PLAN_URL}`]: apiFailure(
        409,
        'INVESTMENT_PLAN_REVISION_CONFLICT',
      ),
    });
    const { result } = render(api, PLAN_ID);
    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));
    const { setup } = result.current.hook;
    if (setup.status !== 'ready' || !setup.plan) throw new Error('not ready');

    act(() =>
      result.current.hook.save.edit(setup.plan, {
        name: 'Outro',
        description: '',
      }),
    );
    await waitFor(() =>
      expect(result.current.hook.save.problem).toMatchObject({
        conflict: true,
      }),
    );
    expect(result.current.location.pathname).toBe(`/planos/${PLAN_ID}/editar`);

    await act(() => result.current.hook.save.reload());

    expect(result.current.hook.save.problem).toBeNull();
    expect(result.current.hook.setup).toMatchObject({
      status: 'ready',
      plan: { revision: 4 },
      loadGeneration: 1,
    });
  });

  it('keeps the input and shows the API message when a create fails', async () => {
    const api = fakeApi({
      [`POST ${API}/investment-plans`]: apiFailure(
        400,
        'INVESTMENT_PLAN_INVALID',
      ),
    });
    const { result } = render(api, undefined);

    act(() =>
      result.current.hook.save.create({ name: 'Reserva', description: '' }),
    );

    await waitFor(() =>
      expect(result.current.hook.save.problem).toEqual({
        message: 'Mensagem de INVESTMENT_PLAN_INVALID.',
        conflict: false,
      }),
    );
    expect(result.current.location.pathname).toBe('/planos/novo');
  });

  it('reports a missing plan separately from a failed read', async () => {
    const missing = render(
      fakeApi({
        [`GET ${PLAN_URL}`]: apiFailure(404, 'INVESTMENT_PLAN_NOT_FOUND'),
      }),
      PLAN_ID,
    );
    await waitFor(() =>
      expect(missing.result.current.hook.setup.status).toBe('missing'),
    );

    const failed = render(
      fakeApi({
        [`GET ${PLAN_URL}`]: apiFailure(500, 'INVESTMENT_PLAN_QUERY_FAILED'),
      }),
      PLAN_ID,
    );
    await waitFor(() =>
      expect(failed.result.current.hook.setup.status).toBe('error'),
    );
  });
});
