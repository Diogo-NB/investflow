import { act, renderHook, waitFor } from '@testing-library/react';
import {
  apiFailure,
  fakeApi,
  harness,
  withLocation,
} from '../../testing/simulator-harness';
import type { OfferSummary } from '../models/offer.types';
import { useOfferList } from './use-offer-list';

const API = '/api/investment-simulator/offers';
const listUrl = (query: string) => `GET ${API}?${query}`;

function offer(
  id: string,
  titleType: OfferSummary['titleType'],
  origin: OfferSummary['origin'],
): OfferSummary {
  return {
    id,
    titleType,
    name: `Oferta ${id}`,
    issuerName: null,
    maturityDate: '2028-12-29',
    redemptionTerms: { kind: 'AT_MATURITY' },
    remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1.1' },
    origin,
    revision: 1,
  };
}

function render(api: ReturnType<typeof fakeApi>, entry: string) {
  return renderHook(withLocation(useOfferList), harness(api, entry));
}

describe('useOfferList', () => {
  it('reads the filtered page and groups it by title type and origin', async () => {
    const items = [
      offer('a', 'CDB', 'SYSTEM'),
      offer('b', 'CDB', 'SYSTEM'),
      offer('c', 'CDB', 'OWN'),
      offer('d', 'LCI', 'SYSTEM'),
    ];
    const api = fakeApi({
      [listUrl('page=2&pageSize=20&q=banco&titleType=CDB')]: {
        items,
        total: 24,
        page: 2,
        pageSize: 20,
      },
    });
    const { result } = render(api, '/ofertas?q=banco&titleType=CDB&page=2');

    await waitFor(() => expect(result.current.hook.state.status).toBe('ready'));
    const { state } = result.current.hook;
    expect(state.status === 'ready' && state.lastPage).toBe(2);
    expect(
      state.status === 'ready' &&
        state.groups.map((group) => [
          group.titleType,
          group.origin,
          group.offers.map(({ id }) => id),
        ]),
    ).toEqual([
      ['CDB', 'SYSTEM', ['a', 'b']],
      ['CDB', 'OWN', ['c']],
      ['LCI', 'SYSTEM', ['d']],
    ]);
    expect(result.current.hook.filtered).toBe(true);
  });

  it('narrows the list to own or system offers', async () => {
    const api = fakeApi({
      [listUrl('page=1&pageSize=20&titleType=LCI&origin=OWN')]: {
        items: [offer('a', 'LCI', 'OWN')],
        total: 1,
        page: 1,
        pageSize: 20,
      },
    });
    const { result } = render(api, '/ofertas?origin=OWN&titleType=LCI');

    expect(result.current.hook.filters).toEqual({
      titleType: 'LCI',
      origin: 'OWN',
    });
    await waitFor(() => expect(result.current.hook.state.status).toBe('ready'));
  });

  it('starts a new search or filter at the first page', async () => {
    const empty = { items: [], total: 0, page: 1, pageSize: 20 };
    const api = fakeApi({
      [listUrl('page=3&pageSize=20')]: empty,
      [listUrl('page=1&pageSize=20&q=banco')]: empty,
      [listUrl('page=1&pageSize=20&q=banco&titleType=LCA')]: empty,
      [listUrl('page=1&pageSize=20&q=banco&titleType=LCA&origin=SYSTEM')]:
        empty,
      [listUrl('page=1&pageSize=20&titleType=LCA&origin=SYSTEM')]: empty,
    });
    const { result } = render(api, '/ofertas?page=3');

    act(() => result.current.hook.submitSearch('  banco '));
    expect(result.current.location.search).toBe('?q=banco');
    act(() => result.current.hook.setTitleType('LCA'));
    expect(result.current.location.search).toBe('?q=banco&titleType=LCA');
    act(() => result.current.hook.setOrigin('SYSTEM'));
    expect(result.current.location.search).toBe(
      '?q=banco&titleType=LCA&origin=SYSTEM',
    );
    act(() => result.current.hook.submitSearch(''));
    expect(result.current.location.search).toBe('?titleType=LCA&origin=SYSTEM');
    act(() => result.current.hook.setOrigin(null));
    expect(result.current.location.search).toBe('?titleType=LCA');
  });

  it('drops invalid parameters and pages past the end through replace', async () => {
    const api = fakeApi({
      [listUrl('page=4&pageSize=20&q=x')]: {
        items: [],
        total: 3,
        page: 4,
        pageSize: 20,
      },
    });
    const { result } = render(
      api,
      '/ofertas?q=x&titleType=CRI&origin=MINE&page=4',
    );

    await waitFor(() =>
      expect(result.current.hook.correctedSearch).toBe('?q=x'),
    );
  });

  it('reports a failed read and retries it', async () => {
    let attempts = 0;
    const api = fakeApi({
      [listUrl('page=1&pageSize=20')]: () =>
        ++attempts === 1
          ? apiFailure(500, 'OFFER_QUERY_FAILED')()
          : { items: [], total: 0, page: 1, pageSize: 20 },
    });
    const { result } = render(api, '/ofertas');

    await waitFor(() => expect(result.current.hook.state.status).toBe('error'));
    act(() => result.current.hook.retry());
    await waitFor(() => expect(result.current.hook.state.status).toBe('ready'));
  });
});
