import { act, renderHook, waitFor } from '@testing-library/react';
import {
  apiFailure,
  fakeApi,
  harness,
  withLocation,
} from '../../../testing/simulator-harness';
import {
  simulationResult,
  workspace,
} from '../../../testing/simulator-fixtures';
import type {
  CalculationStatus,
  SimulationComparison,
} from '../../models/simulation.types';
import { useSimulationComparison } from '../use-simulation-comparison';

const A = 'b51b8f16-2b90-4d24-a2f9-5923eb77c16c';
const B = '3bdb3c5d-fb4d-4a52-82a3-8122493ffc7e';
const C = '0b6f4f9e-6a43-4c4e-9f43-2f6f3c1f6a01';

const comparisonUrl = (...ids: string[]) =>
  `GET /api/investment-simulator/simulation-comparisons?ids=${ids.join('%2C')}`;

function compared(id: string, status: CalculationStatus = 'CALCULATED') {
  return {
    ...workspace,
    simulation: { ...workspace.simulation, id },
    calculation: { ...workspace.calculation, status },
    result: simulationResult(),
    standing: {
      position: 1,
      leader: true,
      netAnnualReturnGap: '0',
      netBalanceGap: null,
    },
  };
}

function comparison(
  ...simulations: ReturnType<typeof compared>[]
): SimulationComparison {
  return { settled: true, amountsComparable: false, simulations };
}

function render(api: ReturnType<typeof fakeApi>, search: string) {
  return renderHook(
    withLocation(useSimulationComparison),
    harness(api, `/simulacoes/comparar${search}`),
  );
}

describe('useSimulationComparison', () => {
  it('loads the requested simulations', async () => {
    const data = comparison(compared(A), compared(B));
    const api = fakeApi({ [comparisonUrl(A, B)]: data });
    const { result } = render(api, `?ids=${A},${B}`);

    expect(result.current.hook.state.status).toBe('loading');
    await waitFor(() =>
      expect(result.current.hook.state).toEqual({
        status: 'ready',
        comparison: data,
        updating: false,
      }),
    );
    expect(result.current.hook.listRedirect).toBeNull();
    expect(result.current.hook.correctedSearch).toBeNull();
    expect(result.current.hook.selectionSearch).toBe(`?comparar=${A}%2C${B}`);
  });

  it('reads again only while a simulation is calculating', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let pending = true;
      const api = fakeApi({
        [comparisonUrl(A, B)]: () =>
          comparison(
            compared(A, pending ? 'PENDING' : 'CALCULATED'),
            compared(B),
          ),
      });
      const reads = () => api.calls().length;
      const { result } = render(api, `?ids=${A},${B}`);
      await waitFor(() =>
        expect(result.current.hook.state.status).toBe('ready'),
      );

      pending = false;
      await act(() => vi.advanceTimersByTimeAsync(3000));
      await waitFor(() => expect(reads()).toBe(2));
      await act(() => vi.advanceTimersByTimeAsync(6000));
      expect(reads()).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a deleted simulation as missing', async () => {
    const api = fakeApi({
      [comparisonUrl(A, B)]: apiFailure(404, 'SIMULATION_NOT_FOUND'),
    });
    const { result } = render(api, `?ids=${A},${B}`);

    await waitFor(() =>
      expect(result.current.hook.state.status).toBe('missing'),
    );
  });

  it('reports other failures and retries', async () => {
    let fail = true;
    const api = fakeApi({
      [comparisonUrl(A, B)]: () =>
        fail
          ? apiFailure(500, 'INTERNAL')()
          : comparison(compared(A), compared(B)),
    });
    const { result } = render(api, `?ids=${A},${B}`);
    await waitFor(() =>
      expect(result.current.hook.state).toEqual({
        status: 'error',
        retrying: false,
      }),
    );

    fail = false;
    act(() => result.current.hook.retry());
    await waitFor(() => expect(result.current.hook.state.status).toBe('ready'));
  });

  it('removes a simulation and returns to the list below two', async () => {
    const api = fakeApi({
      [comparisonUrl(A, B, C)]: comparison(
        compared(A),
        compared(B),
        compared(C),
      ),
      [comparisonUrl(A, C)]: comparison(compared(A), compared(C)),
    });
    const { result } = render(api, `?ids=${A},${B},${C}`);
    await waitFor(() => expect(result.current.hook.state.status).toBe('ready'));

    act(() => result.current.hook.remove(B));
    expect(result.current.hook.ids).toEqual([A, C]);
    expect(result.current.hook.listRedirect).toBeNull();

    act(() => result.current.hook.remove(C));
    expect(result.current.hook.listRedirect).toBe(`?comparar=${A}`);
  });

  it('corrects malformed ids without reading them', () => {
    const api = fakeApi({});
    const { result } = render(api, `?ids=${A},x,${A},${B}`);

    expect(result.current.hook.correctedSearch).toBe(`?ids=${A}%2C${B}`);
    expect(api.calls()).toEqual([]);
  });

  it('limits adding to six simulations', () => {
    const ids = [1, 2, 3, 4, 5, 6].map(
      (n) => `00000000-0000-4000-8000-00000000000${n}`,
    );
    const api = fakeApi({ [comparisonUrl(...ids)]: comparison() });

    expect(
      render(api, `?ids=${ids.join(',')}`).result.current.hook.canAdd,
    ).toBe(false);
  });
});
