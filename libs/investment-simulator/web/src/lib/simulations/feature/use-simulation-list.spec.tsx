import { renderHook, waitFor } from '@testing-library/react';
import { apiFailure, fakeApi, harness } from '../../testing/simulator-harness';
import { parsePage, useSimulationList } from './use-simulation-list';

const listUrl = (page: number) =>
  `GET /api/investment-simulator/simulations?page=${page}&pageSize=20`;

const item = {
  id: 'sim',
  fromCatalogOffer: false,
  principal: '10000',
  investmentDate: '2026-01-02',
  maturityDate: '2026-03-02',
  titleType: 'CDB',
  issuerName: 'Banco Local',
  remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1.05' },
  latestCalculation: {
    id: 'calculation',
    calculatedAt: '2026-10-10T12:00:00.000Z',
    outdated: false,
    netBalance: '10168.47',
  },
};

function render(api: ReturnType<typeof fakeApi>, entry = '/simulacoes') {
  return renderHook(useSimulationList, harness(api, entry));
}

describe('useSimulationList', () => {
  it('loads the requested page with its bounds', async () => {
    const api = fakeApi({
      [listUrl(2)]: { items: [item], total: 21, page: 2, pageSize: 20 },
    });
    const { result } = render(api, '/simulacoes?page=2');

    expect(result.current.state.status).toBe('loading');
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(result.current.state).toMatchObject({
      items: [item],
      total: 21,
      lastPage: 2,
      updating: false,
    });
    expect(result.current.correctedPage).toBeNull();
  });

  it('reports an empty list as ready with no items', async () => {
    const api = fakeApi({
      [listUrl(1)]: { items: [], total: 0, page: 1, pageSize: 20 },
    });
    const { result } = render(api);

    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        status: 'ready',
        items: [],
        lastPage: 1,
      }),
    );
  });

  it('retries a failed read on request', async () => {
    let attempts = 0;
    const api = fakeApi({
      [listUrl(1)]: () =>
        ++attempts === 1
          ? apiFailure(500, 'SIMULATION_QUERY_FAILED')()
          : { items: [item], total: 1, page: 1, pageSize: 20 },
    });
    const { result } = render(api);

    await waitFor(() => expect(result.current.state.status).toBe('error'));
    result.current.retry();
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(attempts).toBe(2);
  });

  it('corrects pages past the end and malformed pages', async () => {
    const api = fakeApi({
      [listUrl(3)]: { items: [], total: 20, page: 3, pageSize: 20 },
    });
    const { result } = render(api, '/simulacoes?page=3');
    await waitFor(() => expect(result.current.correctedPage).toBe(1));

    const malformed = render(
      fakeApi({ [listUrl(1)]: { items: [], total: 0, page: 1, pageSize: 20 } }),
      '/simulacoes?page=abc',
    );
    expect(malformed.result.current.correctedPage).toBe(1);
  });

  it('parses only positive integer pages', () => {
    expect(parsePage(null)).toBe(1);
    expect(parsePage('12')).toBe(12);
    for (const param of ['0', '-1', '1.5', 'x', '']) {
      expect(parsePage(param)).toBeNull();
    }
  });
});
