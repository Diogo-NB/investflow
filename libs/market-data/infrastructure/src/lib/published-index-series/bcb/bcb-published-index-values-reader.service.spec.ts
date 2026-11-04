import { EPublishedIndex } from '@investflow/market-data-domain';
import {
  CalendarDate,
  CalendarDateRange,
  EAppErrorCode,
} from '@investflow/shared-domain';
import { BcbPublishedIndexValuesReader } from './bcb-published-index-values-reader.service';

const range = CalendarDateRange.of(
  CalendarDate.of('2026-10-31'),
  CalendarDate.of('2026-11-04'),
);

function respondWith(status: number, body: unknown) {
  return jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

describe('BcbPublishedIndexValuesReader', () => {
  const reader = new BcbPublishedIndexValuesReader();

  afterEach(() => jest.restoreAllMocks());

  it.each([
    [EPublishedIndex.CDI, 4389],
    [EPublishedIndex.SELIC, 1178],
    [EPublishedIndex.SELIC_TARGET, 432],
  ])('asks for the series and dates of %s', async (index, series) => {
    const fetchMock = respondWith(200, []);

    await reader.fetchBetween({ index, range });

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe(`/dados/serie/bcdata.sgs.${series}/dados`);
    expect(url.searchParams.get('dataInicial')).toBe('31/10/2026');
    expect(url.searchParams.get('dataFinal')).toBe('04/11/2026');
  });

  it('converts dates and percentages to fractions', async () => {
    respondWith(200, [{ data: '03/11/2026', valor: '13.65' }]);

    const result = await reader.fetchBetween({
      index: EPublishedIndex.CDI,
      range,
    });

    const [published] = result.value;
    expect(published.referenceDate.toIsoString()).toBe('2026-11-03');
    expect(published.value.toFixed()).toBe('0.1365');
  });

  it('treats a 404 as nothing published', async () => {
    respondWith(404, { erro: { detail: 'Value(s) not found' } });

    const result = await reader.fetchBetween({
      index: EPublishedIndex.CDI,
      range,
    });

    expect(result.value).toEqual([]);
  });

  it.each([
    ['another status', () => respondWith(500, {})],
    ['an unexpected body', () => respondWith(200, [{ data: '2026-11-03' }])],
    [
      'a network failure',
      () =>
        jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('down')),
    ],
  ])('reports %s as a fetch failure', async (_, arrange) => {
    arrange();

    const result = await reader.fetchBetween({
      index: EPublishedIndex.CDI,
      range,
    });

    expect(result.error.code).toBe(
      EAppErrorCode.PUBLISHED_INDEX_VALUES_FETCH_FAILED,
    );
  });
});
