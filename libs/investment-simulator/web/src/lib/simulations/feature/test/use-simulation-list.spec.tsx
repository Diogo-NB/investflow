import { act, renderHook, waitFor } from '@testing-library/react';
import {
  apiFailure,
  fakeApi,
  harness,
  withLocation,
} from '../../../testing/simulator-harness';
import { parsePage } from '../../../pagination/page-search';
import { useSimulationList } from '../use-simulation-list';

const OFFER_ID = 'b51b8f16-2b90-4d24-a2f9-5923eb77c16c';
const CURVE_ID = '3bdb3c5d-fb4d-4a52-82a3-8122493ffc7e';

const listUrl = (page: number, filters = '') =>
  `GET /api/investment-simulator/simulations?page=${page}&pageSize=20${filters}`;

const emptyPage = { items: [], total: 0, page: 1, pageSize: 20 };

const item = {
  id: 'sim',
  offerName: 'CDB 105% do CDI',
  principal: '10000',
  investmentDate: '2026-01-02',
  maturityDate: '2026-03-02',
  titleType: 'CDB',
  issuerName: 'Banco Local',
  remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1.05' },
  calculationStatus: 'CALCULATED',
  result: {
    calculatedAt: '2026-10-10T12:00:00.000Z',
    outdated: false,
    netBalance: '10168.47',
    netAnnualReturn: '0.1112814663816',
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
    expect(result.current.correctedSearch).toBeNull();
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
    await waitFor(() => expect(result.current.correctedSearch).toBe(''));

    const malformed = render(
      fakeApi({ [listUrl(1)]: emptyPage }),
      '/simulacoes?page=abc',
    );
    expect(malformed.result.current.correctedSearch).toBe('');
  });

  it('parses only positive integer pages', () => {
    expect(parsePage(null)).toBe(1);
    expect(parsePage('12')).toBe(12);
    for (const param of ['0', '-1', '1.5', 'x', '']) {
      expect(parsePage(param)).toBeNull();
    }
  });

  it('reads the page again only while one of its rows is calculating', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let status = 'PENDING';
      const api = fakeApi({
        [listUrl(1)]: () => ({
          items: [{ ...item, calculationStatus: status }],
          total: 1,
          page: 1,
          pageSize: 20,
        }),
      });
      const { result } = render(api);
      await waitFor(() => expect(result.current.state.status).toBe('ready'));
      const reads = () =>
        api.calls().filter((call) => call === listUrl(1)).length;

      status = 'CALCULATED';
      await act(() => vi.advanceTimersByTimeAsync(3000));
      await waitFor(() => expect(reads()).toBe(2));
      await act(() => vi.advanceTimersByTimeAsync(9000));

      expect(reads()).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('sends every valid filter from the URL to the request', async () => {
    const filters = `&q=Banco+X&offerId=${OFFER_ID}&curveId=${CURVE_ID}&titleType=LCI&remunerationKind=CDI_PERCENTAGE&calculationStatus=INVALID`;
    const api = fakeApi({ [listUrl(2, filters)]: emptyPage });
    const { result } = render(
      api,
      `/simulacoes?calculationStatus=INVALID&q=Banco+X&page=2&titleType=LCI&curveId=${CURVE_ID}&remunerationKind=CDI_PERCENTAGE&offerId=${OFFER_ID}`,
    );

    expect(result.current.filters).toEqual({
      q: 'Banco X',
      offerId: OFFER_ID,
      curveId: CURVE_ID,
      titleType: 'LCI',
      remunerationKind: 'CDI_PERCENTAGE',
      calculationStatus: 'INVALID',
    });
    expect(result.current.filtered).toBe(true);
    await waitFor(() => expect(api.calls()).toEqual([listUrl(2, filters)]));
  });

  it('drops invalid filter values through replace, keeping the valid ones', async () => {
    const api = fakeApi({ [listUrl(2, '&titleType=CDB')]: emptyPage });
    const { result } = render(
      api,
      '/simulacoes?offerId=nope&titleType=CDB&calculationStatus=DONE&remunerationKind=x&curveId=1&page=2&tab=x',
    );

    expect(result.current.filters).toEqual({ titleType: 'CDB' });
    expect(result.current.correctedSearch).toBe('?titleType=CDB&page=2&tab=x');
  });

  it('starts a changed filter at the first page, keeping unrelated parameters', async () => {
    const api = fakeApi({
      [listUrl(3)]: emptyPage,
      [listUrl(1, '&calculationStatus=FAILED')]: emptyPage,
      [listUrl(1, `&offerId=${OFFER_ID}&calculationStatus=FAILED`)]: emptyPage,
    });
    const { result } = renderHook(
      withLocation(useSimulationList),
      harness(api, '/simulacoes?page=3&tab=x'),
    );

    act(() => result.current.hook.setFilter('calculationStatus', 'FAILED'));
    expect(result.current.location.search).toBe(
      '?tab=x&calculationStatus=FAILED',
    );
    act(() => result.current.hook.setFilter('offerId', OFFER_ID));
    expect(result.current.hook.filters).toEqual({
      offerId: OFFER_ID,
      calculationStatus: 'FAILED',
    });

    act(() => result.current.hook.setFilter('calculationStatus', null));
    expect(result.current.hook.filters).toEqual({ offerId: OFFER_ID });
    act(() => result.current.hook.clearFilters());
    expect(result.current.location.search).toBe('?tab=x');
    expect(result.current.hook.filtered).toBe(false);
  });

  it('tells a filtered empty list from having no simulations', async () => {
    const api = fakeApi({ [listUrl(1, '&titleType=LCA')]: emptyPage });
    const { result } = render(api, '/simulacoes?titleType=LCA');

    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        status: 'ready',
        items: [],
      }),
    );
    expect(result.current.filtered).toBe(true);
  });

  it('requests the sort from the URL, which filters nothing', async () => {
    const api = fakeApi({
      [listUrl(2, '&titleType=CDB&sort=netAnnualReturn')]: emptyPage,
    });
    const { result } = render(
      api,
      '/simulacoes?sort=netAnnualReturn&titleType=CDB&page=2',
    );

    expect(result.current.sort).toBe('netAnnualReturn');
    expect(result.current.filters).toEqual({ titleType: 'CDB' });
    await waitFor(() =>
      expect(api.calls()).toEqual([
        listUrl(2, '&titleType=CDB&sort=netAnnualReturn'),
      ]),
    );
  });

  it('drops an invalid sort through replace', () => {
    const { result } = render(
      fakeApi({ [listUrl(2)]: emptyPage }),
      '/simulacoes?sort=name&page=2',
    );

    expect(result.current.sort).toBeUndefined();
    expect(result.current.correctedSearch).toBe('?page=2');
  });

  it('starts a changed sort at the first page and keeps it when clearing filters', () => {
    const api = fakeApi({
      [listUrl(3, '&titleType=LCI')]: emptyPage,
      [listUrl(1, '&titleType=LCI&sort=netAnnualReturn')]: emptyPage,
      [listUrl(1, '&sort=netAnnualReturn')]: emptyPage,
      [listUrl(1)]: emptyPage,
    });
    const { result } = renderHook(
      withLocation(useSimulationList),
      harness(api, '/simulacoes?titleType=LCI&page=3'),
    );

    act(() => result.current.hook.setSort('netAnnualReturn'));
    expect(result.current.location.search).toBe(
      '?titleType=LCI&sort=netAnnualReturn',
    );
    expect(result.current.hook.filtered).toBe(true);
    act(() => result.current.hook.clearFilters());
    expect(result.current.location.search).toBe('?sort=netAnnualReturn');
    expect(result.current.hook.filtered).toBe(false);
    act(() => result.current.hook.setSort(null));
    expect(result.current.location.search).toBe('');
  });

  describe('selection for comparison', () => {
    const ids = [1, 2, 3, 4, 5, 6, 7].map(
      (n) => `00000000-0000-4000-8000-00000000000${n}`,
    );

    it('keeps the selection across filters and pages', async () => {
      const api = fakeApi({});
      const { result } = renderHook(
        withLocation(useSimulationList),
        harness(api, '/simulacoes?page=2'),
      );

      act(() => result.current.hook.toggleSelected(ids[0]));
      expect(result.current.hook.selected).toEqual([ids[0]]);
      expect(result.current.hook.comparisonSearch).toBeNull();
      expect(result.current.hook.page).toBe(2);

      act(() => result.current.hook.toggleSelected(ids[1]));
      act(() => result.current.hook.setFilter('titleType', 'CDB'));
      expect(result.current.hook.selected).toEqual([ids[0], ids[1]]);
      expect(result.current.hook.comparisonSearch).toBe(
        `?ids=${ids[0]}%2C${ids[1]}`,
      );

      act(() => result.current.hook.toggleSelected(ids[0]));
      expect(result.current.hook.selected).toEqual([ids[1]]);
      act(() => result.current.hook.clearSelection());
      expect(result.current.location.search).toBe('?titleType=CDB');
    });

    it('stops at the comparison limit', async () => {
      const api = fakeApi({});
      const { result } = render(
        api,
        `/simulacoes?comparar=${ids.slice(0, 5).join(',')}`,
      );

      expect(result.current.canSelectMore).toBe(true);
      act(() => result.current.toggleSelected(ids[5]));
      expect(result.current.canSelectMore).toBe(false);
      act(() => result.current.toggleSelected(ids[6]));
      expect(result.current.selected).toEqual(ids.slice(0, 6));
    });

    it('corrects malformed, repeated, or excess ids', () => {
      const api = fakeApi({});
      const { result } = render(
        api,
        `/simulacoes?comparar=${[ids[0], 'x', ids[0], ...ids.slice(1)].join(',')}`,
      );

      expect(result.current.selected).toEqual(ids.slice(0, 6));
      expect(result.current.correctedSearch).toBe(
        `?comparar=${ids.slice(0, 6).join('%2C')}`,
      );
    });
  });
});
