import { act, renderHook, waitFor } from '@testing-library/react';
import {
  apiFailure,
  fakeApi,
  harness,
  withLocation,
} from '../../testing/simulator-harness';
import type { CurveDetail } from '../models/curve.types';
import { useCurveDetails } from './use-curve-details';

const API = '/api/investment-simulator';
const CURVE_ID = '4c1f0b0e-6a43-4d8e-9b3e-0f8e1d7a2c55';
const simulationsUrl = `GET ${API}/simulations?page=1&pageSize=20&curveId=${CURVE_ID}`;

const curve: CurveDetail = {
  id: CURVE_ID,
  index: 'SELIC',
  name: 'SELIC base',
  description: null,
  origin: 'OWN',
  revision: 1,
  intervals: [
    { startDate: '2026-10-01', endDate: '2026-12-31', value: '0.12' },
  ],
};

const routes = {
  [`GET ${API}/curves/${CURVE_ID}`]: curve,
  [simulationsUrl]: {
    items: [{ id: 'sim' }],
    total: 21,
    page: 1,
    pageSize: 20,
  },
};

function render(api: ReturnType<typeof fakeApi>, entry: string) {
  return renderHook(
    withLocation(() => useCurveDetails(CURVE_ID)),
    harness(api, entry),
  );
}

describe('useCurveDetails', () => {
  it("reads the curve and the user's simulations that use it", async () => {
    const { result } = render(fakeApi(routes), `/curvas/${CURVE_ID}`);

    await waitFor(() =>
      expect(result.current.hook.state).toEqual({ status: 'ready', curve }),
    );
    await waitFor(() =>
      expect(result.current.hook.simulations.state).toEqual({
        status: 'ready',
        items: [{ id: 'sim' }],
        total: 21,
      }),
    );
  });

  it('keeps the curve when its simulations cannot be read, and retries them', async () => {
    let attempts = 0;
    const api = fakeApi({
      ...routes,
      [simulationsUrl]: () =>
        ++attempts === 1
          ? apiFailure(500, 'SIMULATION_QUERY_FAILED')()
          : { items: [], total: 0, page: 1, pageSize: 20 },
    });
    const { result } = render(api, `/curvas/${CURVE_ID}`);

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

  it('reports a missing curve separately from a failed read', async () => {
    const missing = render(
      fakeApi({
        ...routes,
        [`GET ${API}/curves/${CURVE_ID}`]: apiFailure(404, 'CURVE_NOT_FOUND'),
      }),
      `/curvas/${CURVE_ID}`,
    );
    await waitFor(() =>
      expect(missing.result.current.hook.state.status).toBe('missing'),
    );

    const failed = render(
      fakeApi({
        ...routes,
        [`GET ${API}/curves/${CURVE_ID}`]: apiFailure(
          500,
          'CURVE_QUERY_FAILED',
        ),
      }),
      `/curvas/${CURVE_ID}`,
    );
    await waitFor(() =>
      expect(failed.result.current.hook.state.status).toBe('error'),
    );
  });

  it('creates one copy per click and opens it, keeping the list parameters', async () => {
    const api = fakeApi({
      ...routes,
      [`POST ${API}/curves/${CURVE_ID}/duplicates`]: { curveId: 'copy' },
    });
    const { result } = render(api, `/curvas/${CURVE_ID}?index=SELIC&tab=x`);
    await waitFor(() => expect(result.current.hook.state.status).toBe('ready'));

    act(() => {
      result.current.hook.duplicate.run();
      result.current.hook.duplicate.run();
    });

    await waitFor(() =>
      expect(result.current.location.pathname).toBe('/curvas/copy'),
    );
    expect(result.current.location.search).toBe('?index=SELIC');
    expect(api.calls().filter((call) => call.startsWith('POST'))).toHaveLength(
      1,
    );
  });

  it('reports a failed copy without leaving', async () => {
    const api = fakeApi({
      ...routes,
      [`POST ${API}/curves/${CURVE_ID}/duplicates`]: apiFailure(
        500,
        'INTERNAL',
      ),
    });
    const { result } = render(api, `/curvas/${CURVE_ID}`);
    await waitFor(() => expect(result.current.hook.state.status).toBe('ready'));

    act(() => result.current.hook.duplicate.run());

    await waitFor(() =>
      expect(result.current.hook.duplicate.failed).toBe(true),
    );
    expect(result.current.location.pathname).toBe(`/curvas/${CURVE_ID}`);
  });

  it('deletes the curve and returns to the list', async () => {
    const api = fakeApi({
      ...routes,
      [`DELETE ${API}/curves/${CURVE_ID}`]: undefined,
    });
    const { result } = render(api, `/curvas/${CURVE_ID}?index=SELIC`);
    await waitFor(() => expect(result.current.hook.state.status).toBe('ready'));

    act(() => result.current.hook.remove.run());

    await waitFor(() =>
      expect(result.current.location.pathname).toBe('/curvas'),
    );
    expect(result.current.location.search).toBe('?index=SELIC');
    expect(api.calls()).toContain(`DELETE ${API}/curves/${CURVE_ID}`);
  });
});
