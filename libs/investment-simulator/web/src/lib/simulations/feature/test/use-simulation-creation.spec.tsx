import { act, renderHook, waitFor } from '@testing-library/react';
import {
  apiFailure,
  fakeApi,
  harness,
  withLocation,
} from '../../../testing/simulator-harness';
import { optionsRoute, workspace } from '../../../testing/simulator-fixtures';
import type { SimulationFormValues } from '../../utils/simulation-form';
import { useSimulationCreation } from '../use-simulation-creation';

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

const templateRoutes = {
  ...optionsRoute,
  [`GET ${API}/simulation-workspaces/sim`]: workspace,
};

const emptyList = {
  [`GET ${API}/simulations?page=1&pageSize=20`]: {
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  },
};

function render(api: ReturnType<typeof fakeApi>, entry = '/simulacoes/nova') {
  return renderHook(
    withLocation(() => useSimulationCreation()),
    harness(api, entry),
  );
}

describe('useSimulationCreation', () => {
  it('starts from blank values once the catalogs load', async () => {
    const { result } = render(fakeApi(optionsRoute));

    expect(result.current.hook.setup.status).toBe('loading');
    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));
    const setup = result.current.hook.setup;
    expect(setup.status === 'ready' && setup.templateId).toBeNull();
    expect(setup.status === 'ready' && setup.initialValues).toMatchObject({
      offerMode: 'existing',
      offerId: '',
      curveId: 'cdi',
      investmentDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });

  it('duplicates a saved simulation with the same offer, curve and investment', async () => {
    const { result } = render(
      fakeApi(templateRoutes),
      '/simulacoes/nova?a-partir-de=sim',
    );

    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));
    const setup = result.current.hook.setup;
    expect(setup.status === 'ready' && setup.templateId).toBe('sim');
    expect(setup.status === 'ready' && setup.initialValues).toMatchObject({
      offerMode: 'existing',
      offerId: 'cdi-offer',
      principal: '10000',
      curveId: 'cdi',
    });
  });

  it('reports a missing template separately from a failed read', async () => {
    const missing = render(
      fakeApi({
        ...optionsRoute,
        [`GET ${API}/simulation-workspaces/gone`]: apiFailure(
          404,
          'SIMULATION_NOT_FOUND',
        ),
      }),
      '/simulacoes/nova?a-partir-de=gone',
    );
    await waitFor(() =>
      expect(missing.result.current.hook.setup.status).toBe('missing'),
    );

    const failed = render(
      fakeApi({
        [`GET ${API}/simulation-options`]: apiFailure(
          500,
          'SIMULATION_QUERY_FAILED',
        ),
      }),
    );
    await waitFor(() =>
      expect(failed.result.current.hook.setup.status).toBe('error'),
    );
  });

  it('creates a simulation with typed terms and opens it with its data loaded', async () => {
    const api = fakeApi({
      ...templateRoutes,
      ...emptyList,
      [`POST ${API}/simulations`]: { simulationId: 'sim' },
    });
    const { result } = render(api);
    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));

    act(() => result.current.hook.create.run(typed, vi.fn()));

    await waitFor(() =>
      expect(result.current.location.pathname).toBe('/simulacoes/sim'),
    );
    expect(api.bodies(`POST ${API}/simulations`)).toEqual([
      {
        offer: {
          new: {
            titleType: 'LCI',
            name: 'LCI digitada',
            issuerName: 'Banco Local',
            maturityDate: '2026-03-02',
            redemptionTerms: { kind: 'DAILY' },
            remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1.05' },
          },
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

  it('opens the created simulation even when reading it ahead fails', async () => {
    const api = fakeApi({
      ...optionsRoute,
      ...emptyList,
      [`POST ${API}/simulations`]: { simulationId: 'sim' },
      [`GET ${API}/simulation-workspaces/sim`]: apiFailure(
        500,
        'SIMULATION_WORKSPACE_QUERY_FAILED',
      ),
    });
    const onProblem = vi.fn();
    const { result } = render(api);
    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));

    act(() => result.current.hook.create.run(values, onProblem));

    await waitFor(() =>
      expect(result.current.location.pathname).toBe('/simulacoes/sim'),
    );
    expect(onProblem).not.toHaveBeenCalled();
    expect(result.current.hook.create.problem).toBeNull();
  });

  it('stays on the new simulation with the rejection when saving fails', async () => {
    const api = fakeApi({
      ...optionsRoute,
      [`POST ${API}/simulations`]: apiFailure(
        422,
        'INVESTMENT_DATE_NOT_BUSINESS_DAY',
        { field: 'investmentDate', date: '2026-01-03' },
      ),
    });
    const onProblem = vi.fn();
    const { result } = render(api);
    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));

    act(() => result.current.hook.create.run(values, onProblem));

    await waitFor(() => expect(onProblem).toHaveBeenCalled());
    expect(onProblem.mock.calls[0][0]).toEqual({
      message: 'Mensagem de INVESTMENT_DATE_NOT_BUSINESS_DAY.',
      field: 'investmentDate',
      conflict: false,
    });
    expect(result.current.hook.create.problem?.field).toBe('investmentDate');
    expect(result.current.location.pathname).toBe('/simulacoes/nova');
  });

  it('ignores repeated creates while one is pending', async () => {
    let release = () => undefined as void;
    const api = fakeApi({
      ...optionsRoute,
      ...emptyList,
      [`POST ${API}/simulations`]: () =>
        new Promise((resolve) => {
          release = () => resolve({ simulationId: 'sim' });
        }),
      [`GET ${API}/simulation-workspaces/sim`]: workspace,
    });
    const { result } = render(api);
    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));

    act(() => result.current.hook.create.run(values, vi.fn()));
    act(() => result.current.hook.create.run(values, vi.fn()));
    await waitFor(() =>
      expect(api.calls()).toContain(`POST ${API}/simulations`),
    );
    release();
    await waitFor(() =>
      expect(result.current.location.pathname).toBe('/simulacoes/sim'),
    );

    expect(api.calls().filter((call) => call.startsWith('POST'))).toHaveLength(
      1,
    );
  });
});
