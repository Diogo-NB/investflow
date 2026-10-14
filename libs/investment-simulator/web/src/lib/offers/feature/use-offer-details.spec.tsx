import { act, renderHook, waitFor } from '@testing-library/react';
import {
  apiFailure,
  fakeApi,
  harness,
  withLocation,
} from '../../testing/simulator-harness';
import type { OfferSummary } from '../models/offer.types';
import { useOfferDetails } from './use-offer-details';

const API = '/api/investment-simulator';
const OFFER_ID = 'b51b8f16-2b90-4d24-a2f9-5923eb77c16c';
const simulationsUrl = `GET ${API}/simulations?page=1&pageSize=20&offerId=${OFFER_ID}`;

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
  [simulationsUrl]: {
    items: [{ id: 'sim' }],
    total: 23,
    page: 1,
    pageSize: 20,
  },
};

function render(api: ReturnType<typeof fakeApi>, entry: string) {
  return renderHook(
    withLocation(() => useOfferDetails(OFFER_ID)),
    harness(api, entry),
  );
}

describe('useOfferDetails', () => {
  it("reads the offer and the user's simulations that use it", async () => {
    const { result } = render(fakeApi(routes), `/ofertas/${OFFER_ID}`);

    await waitFor(() => expect(result.current.hook.state.status).toBe('ready'));
    await waitFor(() =>
      expect(result.current.hook.simulations.state).toEqual({
        status: 'ready',
        items: [{ id: 'sim' }],
        total: 23,
      }),
    );
  });

  it('keeps the offer when its simulations cannot be read, and retries them', async () => {
    let attempts = 0;
    const api = fakeApi({
      ...routes,
      [simulationsUrl]: () =>
        ++attempts === 1
          ? apiFailure(500, 'SIMULATION_QUERY_FAILED')()
          : { items: [], total: 0, page: 1, pageSize: 20 },
    });
    const { result } = render(api, `/ofertas/${OFFER_ID}`);

    await waitFor(() =>
      expect(result.current.hook.simulations.state.status).toBe('error'),
    );
    expect(result.current.hook.state.status).toBe('ready');
    act(() => result.current.hook.simulations.retry());
    await waitFor(() =>
      expect(result.current.hook.simulations.state).toMatchObject({
        status: 'ready',
        total: 0,
      }),
    );
  });

  it('reports a missing offer separately from a failed read', async () => {
    const missing = render(
      fakeApi({
        ...routes,
        [`GET ${API}/offers/${OFFER_ID}`]: apiFailure(404, 'OFFER_NOT_FOUND'),
      }),
      `/ofertas/${OFFER_ID}`,
    );
    await waitFor(() =>
      expect(missing.result.current.hook.state.status).toBe('missing'),
    );

    const failed = render(
      fakeApi({
        ...routes,
        [`GET ${API}/offers/${OFFER_ID}`]: apiFailure(
          500,
          'OFFER_QUERY_FAILED',
        ),
      }),
      `/ofertas/${OFFER_ID}`,
    );
    await waitFor(() =>
      expect(failed.result.current.hook.state.status).toBe('error'),
    );
  });

  it('creates one copy per click and opens it, keeping the list parameters', async () => {
    const api = fakeApi({
      ...routes,
      [`POST ${API}/offers/${OFFER_ID}/duplicates`]: { offerId: 'copy' },
    });
    const { result } = render(api, `/ofertas/${OFFER_ID}?titleType=CDB&tab=x`);
    await waitFor(() => expect(result.current.hook.state.status).toBe('ready'));

    act(() => {
      result.current.hook.duplicate.run();
      result.current.hook.duplicate.run();
    });

    await waitFor(() =>
      expect(result.current.location.pathname).toBe('/ofertas/copy'),
    );
    expect(result.current.location.search).toBe('?titleType=CDB');
    expect(api.calls().filter((call) => call.startsWith('POST'))).toHaveLength(
      1,
    );
  });

  it('deletes the offer and returns to the list', async () => {
    const api = fakeApi({
      ...routes,
      [`DELETE ${API}/offers/${OFFER_ID}`]: undefined,
    });
    const { result } = render(
      api,
      `/ofertas/${OFFER_ID}?q=banco&origin=OWN&page=2`,
    );
    await waitFor(() => expect(result.current.hook.state.status).toBe('ready'));

    act(() => result.current.hook.remove.run());

    await waitFor(() =>
      expect(result.current.location.pathname).toBe('/ofertas'),
    );
    expect(result.current.location.search).toBe('?q=banco&origin=OWN&page=2');
    expect(api.calls()).toContain(`DELETE ${API}/offers/${OFFER_ID}`);
  });
});
