import { act, renderHook, waitFor } from '@testing-library/react';
import {
  apiFailure,
  fakeApi,
  harness,
  withLocation,
} from '../../testing/simulator-harness';
import { optionsRoute, workspace } from '../../testing/simulator-fixtures';
import type { SimulationFormValues } from '../utils/simulation-form';
import { useSimulationWorkspace } from './use-simulation-workspace';

const API = '/api/investment-simulator';

const values: SimulationFormValues = {
  offerId: '',
  principal: '10.000',
  investmentDate: '2026-01-02',
  titleType: 'LCI',
  issuerName: 'Banco Local',
  remunerationKind: 'CDI_PERCENTAGE',
  rate: '105',
  maturityDate: '2026-03-02',
  redemptionKind: 'DAILY',
  curveId: 'cdi',
};

const savedRoutes = {
  ...optionsRoute,
  [`GET ${API}/simulation-workspaces/sim`]: workspace,
};

function render(
  api: ReturnType<typeof fakeApi>,
  id: string | undefined,
  entry: string,
) {
  return renderHook(
    withLocation(() => useSimulationWorkspace(id)),
    harness(api, entry),
  );
}

describe('useSimulationWorkspace', () => {
  it('opens a saved simulation with its calculations from one screen read', async () => {
    const api = fakeApi(savedRoutes);
    const { result } = render(api, 'sim', '/simulacoes/sim');

    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));
    const setup = result.current.hook.setup;
    expect(setup.status === 'ready' && setup.simulation).toEqual(
      workspace.simulation,
    );
    expect(setup.status === 'ready' && setup.calculations).toEqual(
      workspace.calculations,
    );
    expect(api.calls().sort()).toEqual([
      `GET ${API}/simulation-options`,
      `GET ${API}/simulation-workspaces/sim`,
    ]);
  });

  it('starts a new simulation from blank values once the catalogs load', async () => {
    const { result } = render(
      fakeApi(optionsRoute),
      undefined,
      '/simulacoes/nova',
    );

    expect(result.current.hook.setup.status).toBe('loading');
    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));
    const setup = result.current.hook.setup;
    expect(setup.status === 'ready' && setup.simulation).toBeNull();
    expect(setup.status === 'ready' && setup.calculations).toEqual([]);
    expect(setup.status === 'ready' && setup.initialValues).toMatchObject({
      titleType: 'CDB',
      issuerName: '',
      curveId: 'cdi',
      investmentDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });

  it('duplicates a saved simulation as new custom terms', async () => {
    const { result } = render(
      fakeApi(savedRoutes),
      undefined,
      '/simulacoes/nova?a-partir-de=sim',
    );

    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));
    const setup = result.current.hook.setup;
    expect(setup.status === 'ready' && setup.simulation).toBeNull();
    expect(setup.status === 'ready' && setup.initialValues).toMatchObject({
      offerId: '',
      principal: '10000',
      rate: '105',
    });
  });

  it('creates, calculates and opens the new simulation with its data loaded', async () => {
    const api = fakeApi({
      ...savedRoutes,
      [`POST ${API}/simulations`]: { simulationId: 'sim', calculationId: 'c1' },
      [`GET ${API}/simulations?page=1&pageSize=20`]: {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      },
    });
    const { result } = render(api, undefined, '/simulacoes/nova');
    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));

    act(() => result.current.hook.calculate.run(values));

    await waitFor(() =>
      expect(result.current.location.pathname).toBe('/simulacoes/sim'),
    );
    expect(api.bodies(`POST ${API}/simulations`)).toEqual([
      {
        terms: {
          titleType: 'LCI',
          issuerName: 'Banco Local',
          maturityDate: '2026-03-02',
          redemptionTerms: { kind: 'DAILY' },
          remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1.05' },
        },
        investment: {
          principal: '10000',
          investmentDate: '2026-01-02',
          curveId: 'cdi',
        },
      },
    ]);
    expect(api.calls()).toContain(`GET ${API}/simulation-workspaces/sim`);
  });

  it('stays on the new simulation with the rejection when the calculation fails', async () => {
    const api = fakeApi({
      ...savedRoutes,
      [`POST ${API}/simulations`]: apiFailure(
        422,
        'INVESTMENT_DATE_NOT_BUSINESS_DAY',
        { field: 'investmentDate', date: '2026-01-03' },
      ),
    });
    const onProblem = vi.fn();
    const { result } = render(api, undefined, '/simulacoes/nova');
    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));

    act(() => result.current.hook.calculate.run(values, { onProblem }));

    await waitFor(() => expect(onProblem).toHaveBeenCalled());
    expect(onProblem.mock.calls[0][0]).toEqual({
      message: 'Mensagem de INVESTMENT_DATE_NOT_BUSINESS_DAY.',
      field: 'investmentDate',
    });
    expect(result.current.hook.calculate.problem?.field).toBe('investmentDate');
    expect(result.current.location.pathname).toBe('/simulacoes/nova');
  });

  it('calculates the edited investment under the saved terms and shows the new latest result', async () => {
    const api = fakeApi({
      ...savedRoutes,
      [`POST ${API}/simulations/sim/calculations`]: {
        simulationId: 'sim',
        calculationId: 'c2',
      },
    });
    const onSaved = vi.fn();
    const { result } = render(
      api,
      'sim',
      '/simulacoes/sim?calculo=calculation',
    );
    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));

    act(() =>
      result.current.hook.calculate.run(
        { ...values, offerId: 'offer' },
        { onSaved },
      ),
    );

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(api.bodies(`POST ${API}/simulations/sim/calculations`)).toEqual([
      {
        principal: '10000',
        investmentDate: '2026-01-02',
        curveId: 'cdi',
      },
    ]);
    expect(api.calls().filter((call) => !call.startsWith('GET'))).toEqual([
      `POST ${API}/simulations/sim/calculations`,
    ]);
    expect(result.current.location.search).toBe('');
    expect(result.current.hook.calculate.problem).toBeNull();
  });

  it('keeps the edits and reports the field when the calculation is rejected', async () => {
    const api = fakeApi({
      ...savedRoutes,
      [`POST ${API}/simulations/sim/calculations`]: apiFailure(
        422,
        'INVESTMENT_PRINCIPAL_INVALID',
      ),
    });
    const onProblem = vi.fn();
    const onSaved = vi.fn();
    const { result } = render(api, 'sim', '/simulacoes/sim');
    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));

    act(() =>
      result.current.hook.calculate.run(values, { onProblem, onSaved }),
    );

    await waitFor(() => expect(onProblem).toHaveBeenCalled());
    expect(onProblem.mock.calls[0][0]).toMatchObject({ field: 'principal' });
    expect(onSaved).not.toHaveBeenCalled();
    expect(result.current.hook.calculate.problem?.field).toBe('principal');
  });

  it('explains a network failure without exposing it', async () => {
    const api = fakeApi({
      ...savedRoutes,
      [`POST ${API}/simulations/sim/calculations`]: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    const onProblem = vi.fn();
    const { result } = render(api, 'sim', '/simulacoes/sim');
    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));

    act(() => result.current.hook.calculate.run(values, { onProblem }));

    await waitFor(() => expect(onProblem).toHaveBeenCalled());
    expect(onProblem.mock.calls[0][0]).toEqual({
      message:
        'Não foi possível concluir. Verifique sua conexão e tente novamente.',
      field: null,
    });
  });

  it('ignores repeated calculate requests while one is pending', async () => {
    let release = () => undefined as void;
    const api = fakeApi({
      ...savedRoutes,
      [`POST ${API}/simulations/sim/calculations`]: () =>
        new Promise((resolve) => {
          release = () => resolve({ simulationId: 'sim', calculationId: 'c2' });
        }),
    });
    const { result } = render(api, 'sim', '/simulacoes/sim');
    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));

    act(() => result.current.hook.calculate.run(values));
    act(() => result.current.hook.calculate.run(values));
    await waitFor(() =>
      expect(api.calls()).toContain(`POST ${API}/simulations/sim/calculations`),
    );
    release();
    await waitFor(() =>
      expect(result.current.hook.calculate.pending).toBe(false),
    );

    expect(api.calls().filter((call) => call.startsWith('POST'))).toHaveLength(
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

  it('deletes the simulation and returns to the list', async () => {
    const api = fakeApi({
      ...savedRoutes,
      [`DELETE ${API}/simulations/sim`]: undefined,
    });
    const { result } = render(api, 'sim', '/simulacoes/sim');
    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));

    act(() => result.current.hook.remove.run());

    await waitFor(() =>
      expect(result.current.location.pathname).toBe('/simulacoes'),
    );
    expect(api.calls()).toContain(`DELETE ${API}/simulations/sim`);
  });
});
