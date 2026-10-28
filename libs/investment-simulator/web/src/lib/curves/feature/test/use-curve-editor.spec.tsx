import { act, renderHook, waitFor } from '@testing-library/react';
import {
  apiFailure,
  fakeApi,
  harness,
  withLocation,
} from '../../../testing/simulator-harness';
import type { CurveDetail } from '../../models/curve.types';
import { blankCurveValues, curveValues } from '../../utils/curve-form';
import { useCurveEditor } from '../use-curve-editor';

const API = '/api/investment-simulator';
const CURVE_ID = '4c1f0b0e-6a43-4d8e-9b3e-0f8e1d7a2c55';

const curve: CurveDetail = {
  id: CURVE_ID,
  index: 'CDI',
  name: 'CDI base',
  description: null,
  origin: 'OWN',
  revision: 2,
  intervals: [
    { startDate: '2026-10-01', endDate: '2026-12-31', value: '0.12' },
  ],
};

const routes = {
  [`GET ${API}/curves/${CURVE_ID}`]: curve,
  [`GET ${API}/simulations?page=1&pageSize=20&curveId=${CURVE_ID}`]: {
    items: [],
    total: 2,
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
    withLocation(() => useCurveEditor(id)),
    harness(api, entry),
  );
}

describe('useCurveEditor', () => {
  it('starts an own curve from its content with the affected simulations', async () => {
    const { result } = render(
      fakeApi(routes),
      CURVE_ID,
      `/curvas/${CURVE_ID}/editar`,
    );

    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));
    const { setup } = result.current.hook;
    expect(setup.status === 'ready' && setup.initialValues).toEqual(
      curveValues(curve),
    );
    await waitFor(() =>
      expect(result.current.hook.simulations).toMatchObject({
        status: 'ready',
        total: 2,
      }),
    );
  });

  it('does not edit a system curve', async () => {
    const { result } = render(
      fakeApi({
        ...routes,
        [`GET ${API}/curves/${CURVE_ID}`]: { ...curve, origin: 'SYSTEM' },
      }),
      CURVE_ID,
      `/curvas/${CURVE_ID}/editar`,
    );

    await waitFor(() =>
      expect(result.current.hook.setup.status).toBe('read-only'),
    );
  });

  it('has its own state for a missing curve', async () => {
    const { result } = render(
      fakeApi({
        ...routes,
        [`GET ${API}/curves/${CURVE_ID}`]: apiFailure(404, 'CURVE_NOT_FOUND'),
      }),
      CURVE_ID,
      `/curvas/${CURVE_ID}/editar`,
    );

    await waitFor(() =>
      expect(result.current.hook.setup.status).toBe('missing'),
    );
  });

  it('starts a new curve with the index the list was filtered by', () => {
    const { result } = render(
      fakeApi({}),
      undefined,
      '/curvas/nova?index=IPCA',
    );

    const { setup } = result.current.hook;
    expect(setup.status === 'ready' && setup.initialValues).toEqual(
      blankCurveValues('IPCA'),
    );
  });

  it('creates a curve and opens it, keeping the list parameters', async () => {
    const api = fakeApi({ [`POST ${API}/curves`]: { curveId: 'new-curve' } });
    const { result } = render(api, undefined, '/curvas/nova?index=IPCA');

    act(() =>
      result.current.hook.save.create({
        index: 'IPCA',
        name: ' IPCA base ',
        description: '',
        intervals: [{ start: '01/2027', end: '12/2027', value: '0,4' }],
      }),
    );

    await waitFor(() =>
      expect(result.current.location.pathname).toBe('/curvas/new-curve'),
    );
    expect(result.current.location.search).toBe('?index=IPCA');
    expect(api.bodies(`POST ${API}/curves`)).toEqual([
      {
        index: 'IPCA',
        name: 'IPCA base',
        description: null,
        intervals: [
          { startDate: '2027-01-01', endDate: '2027-12-31', value: '0.004' },
        ],
      },
    ]);
  });

  it('saves only the changed fields with the edited revision, once', async () => {
    let release = () => undefined as void;
    const api = fakeApi({
      ...routes,
      [`PATCH ${API}/curves/${CURVE_ID}`]: () =>
        new Promise((resolve) => {
          release = () => resolve(undefined);
        }),
    });
    const { result } = render(api, CURVE_ID, `/curvas/${CURVE_ID}/editar`);
    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));
    const values = curveValues(curve);
    values.intervals.push({
      start: '2027-01-01',
      end: '2027-06-30',
      value: '11',
    });

    act(() => {
      result.current.hook.save.edit(curve, values);
      result.current.hook.save.edit(curve, values);
    });
    await waitFor(() =>
      expect(api.calls()).toContain(`PATCH ${API}/curves/${CURVE_ID}`),
    );
    release();

    await waitFor(() =>
      expect(result.current.location.pathname).toBe(`/curvas/${CURVE_ID}`),
    );
    expect(api.bodies(`PATCH ${API}/curves/${CURVE_ID}`)).toEqual([
      {
        revision: 2,
        intervals: [
          curve.intervals[0],
          { startDate: '2027-01-01', endDate: '2027-06-30', value: '0.11' },
        ],
      },
    ]);
  });

  it('reports a revision conflict and reloads the saved version', async () => {
    const api = fakeApi({
      ...routes,
      [`PATCH ${API}/curves/${CURVE_ID}`]: apiFailure(
        409,
        'CURVE_REVISION_CONFLICT',
      ),
    });
    const { result } = render(api, CURVE_ID, `/curvas/${CURVE_ID}/editar`);
    await waitFor(() => expect(result.current.hook.setup.status).toBe('ready'));

    act(() =>
      result.current.hook.save.edit(curve, {
        ...curveValues(curve),
        name: 'Outro',
      }),
    );
    await waitFor(() =>
      expect(result.current.hook.save.problem).toMatchObject({
        conflict: true,
      }),
    );
    expect(result.current.location.pathname).toBe(`/curvas/${CURVE_ID}/editar`);

    await act(() => result.current.hook.save.reload());

    expect(result.current.hook.save.problem).toBeNull();
    const { setup } = result.current.hook;
    expect(setup.status === 'ready' && setup.loadGeneration).toBe(1);
  });

  it('shows the API message for a rejected curve and keeps the input', async () => {
    const api = fakeApi({
      [`POST ${API}/curves`]: apiFailure(
        400,
        'INVALID_CURVE',
        {},
        'Os intervalos não podem se sobrepor.',
      ),
    });
    const { result } = render(api, undefined, '/curvas/nova');

    act(() => result.current.hook.save.create(curveValues(curve)));

    await waitFor(() =>
      expect(result.current.hook.save.problem).toEqual({
        message: 'Os intervalos não podem se sobrepor.',
        conflict: false,
      }),
    );
    expect(result.current.location.pathname).toBe('/curvas/nova');
  });
  it('offers the visible curves as bases only when creating', async () => {
    const summary = {
      id: CURVE_ID,
      index: 'CDI',
      name: 'CDI base',
      description: null,
      origin: 'OWN',
      revision: 2,
      coverage: { startDate: '2026-10-01', endDate: '2026-12-31' },
    };
    const creating = render(
      fakeApi({ [`GET ${API}/curves`]: [summary] }),
      undefined,
      '/curvas/nova',
    );
    await waitFor(() =>
      expect(creating.result.current.hook.bases.state).toEqual({
        status: 'ready',
        curves: [summary],
      }),
    );

    const api = fakeApi(routes);
    const editing = render(api, CURVE_ID, `/curvas/${CURVE_ID}/editar`);
    await waitFor(() =>
      expect(editing.result.current.hook.setup.status).toBe('ready'),
    );
    expect(api.calls()).not.toContain(`GET ${API}/curves`);
  });

  it('reads the chosen base, and a later choice wins over a slower one', async () => {
    const other = { ...curve, id: 'other', index: 'SELIC' as const };
    let releaseFirst = () => undefined as void;
    const api = fakeApi({
      [`GET ${API}/curves`]: [],
      [`GET ${API}/curves/${CURVE_ID}`]: () =>
        new Promise((resolve) => {
          releaseFirst = () => resolve(curve);
        }),
      [`GET ${API}/curves/other`]: other,
    });
    const { result } = render(api, undefined, '/curvas/nova');

    let first: Promise<unknown> = Promise.resolve();
    let second: Promise<unknown> = Promise.resolve();
    act(() => {
      first = result.current.hook.bases.read(CURVE_ID);
      second = result.current.hook.bases.read('other');
    });
    await expect(second).resolves.toEqual(other);
    releaseFirst();
    await expect(first).resolves.toBeNull();
    await waitFor(() => expect(result.current.hook.bases.copy).toBe('idle'));
  });

  it('reports a base that cannot be read', async () => {
    const api = fakeApi({
      [`GET ${API}/curves`]: [],
      [`GET ${API}/curves/${CURVE_ID}`]: apiFailure(500, 'CURVE_QUERY_FAILED'),
    });
    const { result } = render(api, undefined, '/curvas/nova');

    let read: Promise<unknown> = Promise.resolve();
    act(() => {
      read = result.current.hook.bases.read(CURVE_ID);
    });
    await expect(read).resolves.toBeNull();
    await waitFor(() => expect(result.current.hook.bases.copy).toBe('failed'));
  });
});
