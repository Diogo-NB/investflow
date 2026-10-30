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

const saveCallbacks = (onProblem = vi.fn(), onOfferSaved = vi.fn()) => ({
  onOfferSaved,
  onProblem,
});

const typedOfferBody = {
  titleType: 'LCI',
  name: 'LCI digitada',
  issuerName: 'Banco Local',
  maturityDate: '2026-03-02',
  redemptionTerms: { kind: 'DAILY' },
  remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1.05' },
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
  const options = harness(api, entry);
  const added = vi.spyOn(options.toasts, 'add');
  const updated = vi.spyOn(options.toasts, 'update');
  const rendered = renderHook(
    withLocation(() => useSimulationCreation()),
    options,
  );
  return { ...rendered, ...options, added, updated };
}

const PLAN_URL = `${API}/investment-plans/plan`;
const fromPlan = '/simulacoes/nova?plano=plan';
const plan = {
  id: 'plan',
  name: 'Reserva',
  description: null,
  revision: 1,
  simulationCount: 2,
  availableSimulationSlots: 48,
  status: {
    calculatingCount: 0,
    pendingIssueCount: 0,
    outdatedResultCount: 0,
    isSettled: true,
  },
};

const createRoutes = {
  ...optionsRoute,
  ...emptyList,
  [`POST ${API}/simulations`]: { simulationId: 'sim' },
  [`GET ${API}/simulation-workspaces/sim`]: workspace,
};

type Rendered = ReturnType<typeof render>;

async function createFrom(rendered: Rendered, onProblem = vi.fn()) {
  await waitFor(() =>
    expect(rendered.result.current.hook.setup.status).toBe('ready'),
  );
  act(() =>
    rendered.result.current.hook.create.run(values, saveCallbacks(onProblem)),
  );
  await waitFor(() =>
    expect(rendered.result.current.location.pathname).toBe('/simulacoes/sim'),
  );
}

// The toast's action, as the viewport would click it.
function clickOfferAction(rendered: Rendered) {
  const offer = rendered.added.mock.calls[0][0];
  act(() => offer.actionProps?.onClick?.({} as never));
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

  it('saves typed terms as an offer, then opens the simulation using it', async () => {
    const api = fakeApi({
      ...templateRoutes,
      ...emptyList,
      [`POST ${API}/offers`]: { offerId: 'typed-offer' },
      [`POST ${API}/simulations`]: { simulationId: 'sim' },
    });
    const onOfferSaved = vi.fn();
    const { result } = render(api);
    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));

    act(() =>
      result.current.hook.create.run(
        typed,
        saveCallbacks(vi.fn(), onOfferSaved),
      ),
    );

    await waitFor(() =>
      expect(result.current.location.pathname).toBe('/simulacoes/sim'),
    );
    expect(onOfferSaved).toHaveBeenCalledWith('typed-offer');
    expect(api.bodies(`POST ${API}/offers`)).toEqual([typedOfferBody]);
    expect(api.bodies(`POST ${API}/simulations`)).toEqual([
      {
        offerId: 'typed-offer',
        investment: {
          principal: '10000',
          investmentDate: '2026-01-02',
          curveId: 'cdi',
        },
      },
    ]);
    // Read again so the form can choose the new offer.
    expect(
      api.calls().filter((call) => call === `GET ${API}/simulation-options`),
    ).toHaveLength(2);
    expect(api.calls()).toContain(`GET ${API}/simulation-workspaces/sim`);
  });

  it('keeps the saved offer chosen when the simulation is then rejected', async () => {
    const api = fakeApi({
      ...optionsRoute,
      [`POST ${API}/offers`]: { offerId: 'typed-offer' },
      [`POST ${API}/simulations`]: apiFailure(422, 'INVESTMENT_TERM_TOO_SHORT'),
    });
    const onProblem = vi.fn();
    const onOfferSaved = vi.fn();
    const { result, added } = render(api);
    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));

    act(() =>
      result.current.hook.create.run(
        typed,
        saveCallbacks(onProblem, onOfferSaved),
      ),
    );

    await waitFor(() => expect(onProblem).toHaveBeenCalled());
    expect(onOfferSaved).toHaveBeenCalledWith('typed-offer');
    // The terms belong to the saved offer now, not to editable fields.
    expect(onProblem.mock.calls[0][0]).toMatchObject({ field: 'offerId' });
    expect(added).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Oferta LCI 105% do CDI salva em Ofertas',
        data: { link: { to: '/ofertas/typed-offer', label: 'Ver oferta' } },
      }),
    );
    expect(result.current.hook.create.problem?.field).toBe('offerId');
    expect(result.current.location.pathname).toBe('/simulacoes/nova');
  });

  it('saves no simulation when the typed offer is rejected', async () => {
    const api = fakeApi({
      ...optionsRoute,
      [`POST ${API}/offers`]: apiFailure(400, 'INVALID_RATE'),
    });
    const onProblem = vi.fn();
    const onOfferSaved = vi.fn();
    const { result } = render(api);
    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));

    act(() =>
      result.current.hook.create.run(
        typed,
        saveCallbacks(onProblem, onOfferSaved),
      ),
    );

    await waitFor(() => expect(onProblem).toHaveBeenCalled());
    expect(onProblem.mock.calls[0][0]).toMatchObject({ field: 'rate' });
    expect(onOfferSaved).not.toHaveBeenCalled();
    expect(result.current.hook.create.problem?.field).toBe('rate');
    expect(api.calls()).not.toContain(`POST ${API}/simulations`);
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

    act(() => result.current.hook.create.run(values, saveCallbacks(onProblem)));

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

    act(() => result.current.hook.create.run(values, saveCallbacks(onProblem)));

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

    act(() => result.current.hook.create.run(values, saveCallbacks()));
    act(() => result.current.hook.create.run(values, saveCallbacks()));
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

  describe('from a plan', () => {
    it('offers the plan once the new simulation is open', async () => {
      const onProblem = vi.fn();
      const rendered = render(
        fakeApi({ ...createRoutes, [`GET ${PLAN_URL}`]: plan }),
        fromPlan,
      );

      await createFrom(rendered, onProblem);

      await waitFor(() => expect(rendered.added).toHaveBeenCalledTimes(1));
      expect(rendered.added.mock.calls[0][0]).toMatchObject({
        title: 'Simulação criada. Adicionar ao plano Reserva?',
        actionProps: { children: 'Adicionar ao plano' },
      });
      expect(onProblem).not.toHaveBeenCalled();
      expect(rendered.result.current.hook.create.problem).toBeNull();
    });

    it.each([
      [
        'is full',
        { [`GET ${PLAN_URL}`]: { ...plan, availableSimulationSlots: 0 } },
      ],
      [
        'is missing or deleted',
        { [`GET ${PLAN_URL}`]: apiFailure(404, 'INVESTMENT_PLAN_NOT_FOUND') },
      ],
    ])('offers nothing when the plan %s', async (_, planRoute) => {
      const onProblem = vi.fn();
      const api = fakeApi({ ...createRoutes, ...planRoute });
      const rendered = render(api, fromPlan);

      await createFrom(rendered, onProblem);

      await waitFor(() =>
        expect(
          rendered.queryClient.getQueryState([
            'investment-plans',
            'detail',
            'plan',
          ])?.status,
        ).not.toBe('pending'),
      );
      await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
      expect(rendered.added).not.toHaveBeenCalled();
      expect(onProblem).not.toHaveBeenCalled();
      expect(rendered.result.current.hook.create.problem).toBeNull();
    });

    it('offers nothing without a plan', async () => {
      const api = fakeApi(createRoutes);
      const rendered = render(api);

      await createFrom(rendered);

      await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
      expect(rendered.added).not.toHaveBeenCalled();
      expect(
        api.calls().some((call) => call.includes('investment-plans')),
      ).toBe(false);
    });

    it('adds the simulation once and links to the plan', async () => {
      const api = fakeApi({
        ...createRoutes,
        [`GET ${PLAN_URL}`]: plan,
        [`POST ${PLAN_URL}/simulations`]: undefined,
      });
      const rendered = render(api, fromPlan);
      await createFrom(rendered);
      await waitFor(() => expect(rendered.added).toHaveBeenCalled());
      const invalidated = vi.spyOn(rendered.queryClient, 'invalidateQueries');

      clickOfferAction(rendered);
      clickOfferAction(rendered);

      await waitFor(() =>
        expect(rendered.updated).toHaveBeenLastCalledWith(
          expect.any(String),
          expect.objectContaining({
            type: 'success',
            title: 'Adicionada ao plano Reserva',
            data: { link: { to: '/planos/plan', label: 'Ver plano' } },
          }),
        ),
      );
      expect(api.bodies(`POST ${PLAN_URL}/simulations`)).toEqual([
        { simulationIds: ['sim'] },
      ]);
      expect(invalidated).toHaveBeenCalledWith({
        queryKey: ['investment-plans'],
      });
    });

    it('says why the add failed without reporting the create as failed', async () => {
      const onProblem = vi.fn();
      const rendered = render(
        fakeApi({
          ...createRoutes,
          [`GET ${PLAN_URL}`]: plan,
          [`POST ${PLAN_URL}/simulations`]: apiFailure(
            422,
            'INVESTMENT_PLAN_SIMULATION_LIMIT',
          ),
        }),
        fromPlan,
      );
      await createFrom(rendered, onProblem);
      await waitFor(() => expect(rendered.added).toHaveBeenCalled());

      clickOfferAction(rendered);

      await waitFor(() =>
        expect(rendered.updated).toHaveBeenLastCalledWith(
          expect.any(String),
          expect.objectContaining({
            type: 'error',
            title: 'Não foi possível adicionar ao plano Reserva',
            description: 'Mensagem de INVESTMENT_PLAN_SIMULATION_LIMIT.',
          }),
        ),
      );
      expect(onProblem).not.toHaveBeenCalled();
      expect(rendered.result.current.hook.create.problem).toBeNull();
      expect(rendered.result.current.location.pathname).toBe('/simulacoes/sim');
    });
  });
});
