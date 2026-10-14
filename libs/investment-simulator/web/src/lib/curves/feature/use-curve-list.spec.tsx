import { act, renderHook, waitFor } from '@testing-library/react';
import {
  apiFailure,
  fakeApi,
  harness,
  withLocation,
} from '../../testing/simulator-harness';
import type { CurveSummary } from '../models/curve.types';
import { useCurveList } from './use-curve-list';

const API = '/api/investment-simulator/curves';

function curve(
  id: string,
  index: CurveSummary['index'],
  origin: CurveSummary['origin'],
): CurveSummary {
  return {
    id,
    index,
    name: id,
    description: null,
    origin,
    revision: 1,
    coverage: { startDate: '2024-01-01', endDate: '2028-12-31' },
  };
}

function render(api: ReturnType<typeof fakeApi>, entry = '/curvas') {
  return renderHook(withLocation(useCurveList), harness(api, entry));
}

describe('useCurveList', () => {
  it('groups the curves by index and origin', async () => {
    const curves = [
      curve('cdi-system', 'CDI', 'SYSTEM'),
      curve('cdi-a', 'CDI', 'OWN'),
      curve('cdi-b', 'CDI', 'OWN'),
      curve('ipca-system', 'IPCA', 'SYSTEM'),
    ];
    const { result } = render(fakeApi({ [`GET ${API}`]: curves }));

    await waitFor(() => expect(result.current.hook.state.status).toBe('ready'));
    const { state } = result.current.hook;
    expect(state.status === 'ready' && state.groups).toEqual([
      { index: 'CDI', origin: 'SYSTEM', curves: [curves[0]] },
      { index: 'CDI', origin: 'OWN', curves: [curves[1], curves[2]] },
      { index: 'IPCA', origin: 'SYSTEM', curves: [curves[3]] },
    ]);
  });

  it('filters by index through the URL', async () => {
    const api = fakeApi({
      [`GET ${API}`]: [],
      [`GET ${API}?index=SELIC`]: [curve('selic', 'SELIC', 'OWN')],
    });
    const { result } = render(api);
    await waitFor(() => expect(result.current.hook.state.status).toBe('ready'));

    act(() => result.current.hook.setIndex('SELIC'));

    await waitFor(() =>
      expect(result.current.location.search).toBe('?index=SELIC'),
    );
    await waitFor(() => {
      const { state } = result.current.hook;
      expect(state.status === 'ready' && state.groups).toHaveLength(1);
    });
    expect(result.current.hook.index).toBe('SELIC');

    act(() => result.current.hook.setIndex(null));
    await waitFor(() => expect(result.current.location.search).toBe(''));
  });

  it('drops an unknown index through replace', () => {
    const { result } = render(
      fakeApi({ [`GET ${API}`]: [] }),
      '/curvas?index=POUPANCA&x=1',
    );

    expect(result.current.hook.index).toBeUndefined();
    expect(result.current.hook.correctedSearch).toBe('?x=1');
  });

  it('reports a failed read and retries it', async () => {
    let attempts = 0;
    const api = fakeApi({
      [`GET ${API}`]: () =>
        ++attempts === 1 ? apiFailure(500, 'CURVE_QUERY_FAILED')() : [],
    });
    const { result } = render(api);

    await waitFor(() => expect(result.current.hook.state.status).toBe('error'));
    act(() => result.current.hook.retry());
    await waitFor(() =>
      expect(result.current.hook.state).toEqual({
        status: 'ready',
        groups: [],
        updating: false,
      }),
    );
  });
});
