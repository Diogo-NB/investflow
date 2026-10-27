import { act, renderHook, waitFor } from '@testing-library/react';
import {
  apiFailure,
  fakeApi,
  harness,
  withLocation,
} from '../../../testing/simulator-harness';
import { optionsRoute, workspace } from '../../../testing/simulator-fixtures';
import type { SimulationFormValues } from '../../utils/simulation-form';
import { useSimulationWorkspace } from '../use-simulation-workspace';

const API = '/api/investment-simulator';

const values: SimulationFormValues = {
  offerMode: 'existing',
  offerId: 'cdi-offer',
  offerName: '',
  principal: '10.000',
  investmentDate: '2026-01-02',
  titleType: 'CDB',
  issuerName: 'Banco Local',
  remunerationKind: 'CDI_PERCENTAGE',
  rate: '105',
  maturityDate: '2026-03-02',
  redemptionKind: 'DAILY',
  curveId: 'cdi',
};

const typed: SimulationFormValues = {
  ...values,
  offerMode: 'new',
  offerName: ' LCI digitada ',
  titleType: 'LCI',
};

const callbacks = () => ({ onSaved: vi.fn(), onProblem: vi.fn() });

const savedRoutes = {
  ...optionsRoute,
  [`GET ${API}/simulation-workspaces/sim`]: workspace,
};

function render(api: ReturnType<typeof fakeApi>, id: string, entry: string) {
  return renderHook(
    withLocation(() => useSimulationWorkspace(id)),
    harness(api, entry),
  );
}

describe('useSimulationWorkspace', () => {
  it('opens a saved simulation with its offer and result from one screen read', async () => {
    const api = fakeApi(savedRoutes);
    const { result } = render(api, 'sim', '/simulacoes/sim');

    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));
    const setup = result.current.hook.setup;
    expect(setup.status === 'ready' && setup.workspace).toEqual(workspace);
    expect(setup.status === 'ready' && setup.initialValues).toMatchObject({
      offerMode: 'existing',
      offerId: 'cdi-offer',
      principal: '10000',
      rate: '105',
      curveId: 'cdi',
    });
    expect(api.calls().sort()).toEqual([
      `GET ${API}/simulation-options`,
      `GET ${API}/simulation-workspaces/sim`,
    ]);
  });

  it("saves an edit with its form's revision and reports the next one", async () => {
    const api = fakeApi({
      ...savedRoutes,
      [`PATCH ${API}/simulations/sim`]: { revision: 3 },
    });
    const onSaved = vi.fn();
    const { result } = render(api, 'sim', '/simulacoes/sim');
    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));

    act(() =>
      result.current.hook.edit.run(values, 2, { onSaved, onProblem: vi.fn() }),
    );

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(values, 3));
    expect(api.bodies(`PATCH ${API}/simulations/sim`)).toEqual([
      {
        revision: 2,
        offer: { id: 'cdi-offer' },
        investment: {
          principal: '10000',
          investmentDate: '2026-01-02',
          curveId: 'cdi',
        },
      },
    ]);
    expect(api.calls().filter((call) => !call.startsWith('GET'))).toEqual([
      `PATCH ${API}/simulations/sim`,
    ]);
    expect(result.current.hook.edit.problem).toBeNull();
  });

  it.each([
    ['an existing offer', values, 'offerId'],
    ['typed terms', typed, 'maturityDate'],
  ] as const)(
    'points a term rejection at the offer field for %s',
    async (_, input, field) => {
      const api = fakeApi({
        ...savedRoutes,
        [`PATCH ${API}/simulations/sim`]: apiFailure(
          422,
          'INVESTMENT_TERM_TOO_SHORT',
        ),
      });
      const onProblem = vi.fn();
      const onSaved = vi.fn();
      const { result } = render(api, 'sim', '/simulacoes/sim');
      await waitFor(() =>
        expect(result.current.hook.setup.status).toBe('ready'),
      );

      act(() => result.current.hook.edit.run(input, 3, { onProblem, onSaved }));

      await waitFor(() => expect(onProblem).toHaveBeenCalled());
      expect(onProblem.mock.calls[0][0]).toMatchObject({ field });
      expect(onSaved).not.toHaveBeenCalled();
    },
  );

  it('reports a revision conflict and reloads the saved version', async () => {
    const api = fakeApi({
      ...savedRoutes,
      [`PATCH ${API}/simulations/sim`]: apiFailure(
        409,
        'SIMULATION_REVISION_CONFLICT',
      ),
    });
    const { result } = render(api, 'sim', '/simulacoes/sim');
    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));

    act(() => result.current.hook.edit.run(values, 3, callbacks()));
    await waitFor(() =>
      expect(result.current.hook.edit.problem).toMatchObject({
        conflict: true,
        field: null,
      }),
    );
    const reads = () =>
      api
        .calls()
        .filter((call) => call === `GET ${API}/simulation-workspaces/sim`)
        .length;
    const before = reads();
    await act(() => result.current.hook.edit.reload());

    expect(result.current.hook.edit.problem).toBeNull();
    expect(reads()).toBe(before + 1);
    const setup = result.current.hook.setup;
    expect(setup.status === 'ready' && setup.loadGeneration).toBe(1);
  });

  it('reads an open simulation again every few seconds without restarting the editor', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const api = fakeApi(savedRoutes);
      const { result } = render(api, 'sim', '/simulacoes/sim');
      await waitFor(() =>
        expect(result.current.hook.setup.status).toBe('ready'),
      );
      const reads = () =>
        api
          .calls()
          .filter((call) => call === `GET ${API}/simulation-workspaces/sim`)
          .length;
      const before = reads();

      await act(() => vi.advanceTimersByTimeAsync(3000));

      await waitFor(() => expect(reads()).toBe(before + 1));
      const setup = result.current.hook.setup;
      expect(setup.status === 'ready' && setup.loadGeneration).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('queues the calculation again and reads the new status', async () => {
    const api = fakeApi({
      ...savedRoutes,
      [`POST ${API}/simulations/sim/recalculate`]: undefined,
    });
    const { result } = render(api, 'sim', '/simulacoes/sim');
    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));
    const before = api.calls().length;

    act(() => result.current.hook.recalculate.run());
    act(() => result.current.hook.recalculate.run());

    await waitFor(() =>
      expect(api.calls().slice(before)).toEqual([
        `POST ${API}/simulations/sim/recalculate`,
        `GET ${API}/simulation-workspaces/sim`,
      ]),
    );
    expect(result.current.hook.recalculate.failed).toBe(false);
  });

  it('explains a network failure without exposing it', async () => {
    const api = fakeApi({
      ...savedRoutes,
      [`PATCH ${API}/simulations/sim`]: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    const onProblem = vi.fn();
    const { result } = render(api, 'sim', '/simulacoes/sim');
    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));

    act(() =>
      result.current.hook.edit.run(values, 3, { onSaved: vi.fn(), onProblem }),
    );

    await waitFor(() => expect(onProblem).toHaveBeenCalled());
    expect(onProblem.mock.calls[0][0]).toEqual({
      message:
        'Não foi possível concluir. Verifique sua conexão e tente novamente.',
      field: null,
      conflict: false,
    });
  });

  it('ignores repeated saves while one is pending', async () => {
    let release = () => undefined as void;
    const api = fakeApi({
      ...savedRoutes,
      [`PATCH ${API}/simulations/sim`]: () =>
        new Promise((resolve) => {
          release = () => resolve({ revision: 3 });
        }),
    });
    const { result } = render(api, 'sim', '/simulacoes/sim');
    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));

    act(() => result.current.hook.edit.run(values, 3, callbacks()));
    act(() => result.current.hook.edit.run(values, 3, callbacks()));
    await waitFor(() =>
      expect(api.calls()).toContain(`PATCH ${API}/simulations/sim`),
    );
    release();
    await waitFor(() => expect(result.current.hook.edit.pending).toBe(false));

    expect(api.calls().filter((call) => call.startsWith('PATCH'))).toHaveLength(
      1,
    );
  });

  it('reports a missing simulation separately from a failed read', async () => {
    const missing = render(
      fakeApi({
        ...optionsRoute,
        [`GET ${API}/simulation-workspaces/gone`]: apiFailure(
          404,
          'SIMULATION_NOT_FOUND',
        ),
      }),
      'gone',
      '/simulacoes/gone',
    );
    await waitFor(() =>
      expect(missing.result.current.hook.setup.status).toBe('missing'),
    );

    const failed = render(
      fakeApi({
        ...optionsRoute,
        [`GET ${API}/simulation-workspaces/sim`]: apiFailure(
          500,
          'SIMULATION_WORKSPACE_QUERY_FAILED',
        ),
      }),
      'sim',
      '/simulacoes/sim',
    );
    await waitFor(() =>
      expect(failed.result.current.hook.setup.status).toBe('error'),
    );
  });

  it('deletes the simulation and returns to the filtered list', async () => {
    const api = fakeApi({
      ...savedRoutes,
      [`DELETE ${API}/simulations/sim`]: undefined,
    });
    const { result } = render(
      api,
      'sim',
      '/simulacoes/sim?titleType=CDB&page=2',
    );
    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));

    act(() => result.current.hook.remove.run());

    await waitFor(() =>
      expect(result.current.location.pathname).toBe('/simulacoes'),
    );
    expect(result.current.location.search).toBe('?titleType=CDB&page=2');
    expect(api.calls()).toContain(`DELETE ${API}/simulations/sim`);
  });
});
