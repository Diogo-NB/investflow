import { act, renderHook, waitFor } from '@testing-library/react';
import {
  apiFailure,
  fakeApi,
  harness,
  withLocation,
} from '../../../testing/simulator-harness';
import type { OfferSummary } from '../../models/offer.types';
import { offerValues, type OfferFormValues } from '../../utils/offer-form';
import { useOfferEditor } from '../use-offer-editor';

const API = '/api/investment-simulator';
const OFFER_ID = 'b51b8f16-2b90-4d24-a2f9-5923eb77c16c';

const offer: OfferSummary = {
  id: OFFER_ID,
  titleType: 'CDB',
  name: 'CDB 110% do CDI',
  issuerName: 'Banco Local',
  maturityDate: '2028-12-29',
  redemptionTerms: { kind: 'DAILY' },
  remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1.1' },
  origin: 'OWN',
  revision: 4,
};

const routes = {
  [`GET ${API}/offers/${OFFER_ID}`]: offer,
  [`GET ${API}/simulations?page=1&pageSize=20&offerId=${OFFER_ID}`]: {
    items: [],
    total: 3,
    page: 1,
    pageSize: 20,
  },
};

function render(
  api: ReturnType<typeof fakeApi>,
  id: string | undefined,
  entry: string,
) {
  return renderHook(
    withLocation(() => useOfferEditor(id)),
    harness(api, entry),
  );
}

describe('useOfferEditor', () => {
  it('starts an own offer from its terms with the affected simulations', async () => {
    const { result } = render(
      fakeApi(routes),
      OFFER_ID,
      `/ofertas/${OFFER_ID}/editar`,
    );

    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));
    const { setup } = result.current.hook;
    expect(setup.status === 'ready' && setup.initialValues).toEqual(
      offerValues(offer),
    );
    await waitFor(() =>
      expect(result.current.hook.simulations).toMatchObject({
        status: 'ready',
        total: 3,
      }),
    );
  });

  it('does not edit a system offer', async () => {
    const { result } = render(
      fakeApi({
        ...routes,
        [`GET ${API}/offers/${OFFER_ID}`]: { ...offer, origin: 'SYSTEM' },
      }),
      OFFER_ID,
      `/ofertas/${OFFER_ID}/editar`,
    );

    await waitFor(() =>
      expect(result.current.hook.setup.status).toBe('read-only'),
    );
  });

  it('creates an offer and opens it, keeping the list parameters', async () => {
    const api = fakeApi({ [`POST ${API}/offers`]: { offerId: 'new-offer' } });
    const { result } = render(api, undefined, '/ofertas/nova?titleType=LCI');
    const values: OfferFormValues = {
      ...offerValues(offer),
      titleType: 'LCI',
      issuerName: ' ',
    };

    act(() => result.current.hook.save.create(values, vi.fn()));

    await waitFor(() =>
      expect(result.current.location.pathname).toBe('/ofertas/new-offer'),
    );
    expect(result.current.location.search).toBe('?titleType=LCI');
    expect(api.bodies(`POST ${API}/offers`)).toEqual([
      {
        titleType: 'LCI',
        name: 'CDB 110% do CDI',
        issuerName: null,
        maturityDate: '2028-12-29',
        redemptionTerms: { kind: 'DAILY' },
        remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1.1' },
      },
    ]);
  });

  it('saves only the changed fields with the edited revision, once', async () => {
    let release = () => undefined as void;
    const api = fakeApi({
      ...routes,
      [`PATCH ${API}/offers/${OFFER_ID}`]: () =>
        new Promise((resolve) => {
          release = () => resolve(undefined);
        }),
    });
    const { result } = render(api, OFFER_ID, `/ofertas/${OFFER_ID}/editar`);
    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));
    const values = { ...offerValues(offer), name: 'CDB renomeado' };

    act(() => {
      result.current.hook.save.edit(offer, values, vi.fn());
      result.current.hook.save.edit(offer, values, vi.fn());
    });
    await waitFor(() =>
      expect(api.calls()).toContain(`PATCH ${API}/offers/${OFFER_ID}`),
    );
    release();

    await waitFor(() =>
      expect(result.current.location.pathname).toBe(`/ofertas/${OFFER_ID}`),
    );
    expect(api.bodies(`PATCH ${API}/offers/${OFFER_ID}`)).toEqual([
      { revision: 4, name: 'CDB renomeado' },
    ]);
  });

  it('reports a revision conflict and reloads the saved version', async () => {
    const api = fakeApi({
      ...routes,
      [`PATCH ${API}/offers/${OFFER_ID}`]: apiFailure(
        409,
        'OFFER_REVISION_CONFLICT',
      ),
    });
    const { result } = render(api, OFFER_ID, `/ofertas/${OFFER_ID}/editar`);
    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));
    const onProblem = vi.fn();

    act(() =>
      result.current.hook.save.edit(
        offer,
        { ...offerValues(offer), name: 'Outro' },
        onProblem,
      ),
    );
    await waitFor(() =>
      expect(result.current.hook.save.problem).toMatchObject({
        conflict: true,
        field: null,
      }),
    );
    expect(onProblem).toHaveBeenCalled();
    expect(result.current.location.pathname).toBe(
      `/ofertas/${OFFER_ID}/editar`,
    );

    await act(() => result.current.hook.save.reload());

    expect(result.current.hook.save.problem).toBeNull();
    const { setup } = result.current.hook;
    expect(setup.status === 'ready' && setup.loadGeneration).toBe(1);
  });

  it('points a rejected name at its field', async () => {
    const api = fakeApi({
      [`POST ${API}/offers`]: apiFailure(400, 'INVALID_OFFER'),
    });
    const { result } = render(api, undefined, '/ofertas/nova');
    const onProblem = vi.fn();

    act(() => result.current.hook.save.create(offerValues(offer), onProblem));

    await waitFor(() => expect(onProblem).toHaveBeenCalled());
    expect(onProblem.mock.calls[0][0]).toMatchObject({
      field: 'name',
      conflict: false,
    });
  });
});
