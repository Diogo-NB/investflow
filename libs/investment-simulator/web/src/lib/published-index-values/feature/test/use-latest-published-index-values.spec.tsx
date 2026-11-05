import { act, renderHook, waitFor } from '@testing-library/react';
import type { RemunerationKind } from '../../../offers/models/offer-terms';
import {
  apiFailure,
  fakeApi,
  harness,
} from '../../../testing/simulator-harness';
import { useLatestPublishedIndexValues } from '../use-latest-published-index-values';
import { useRateReferenceHint } from '../use-rate-reference-hint';

const LATEST = 'GET /api/market-data/published-index-values/latest';

const values = {
  items: [
    { index: 'CDI', referenceDate: '2026-11-03', value: '0.1365' },
    { index: 'SELIC', referenceDate: '2026-11-04', value: '0.1366' },
    { index: 'SELIC_TARGET', referenceDate: '2026-11-04', value: '0.1375' },
  ],
};

const FAILURE = apiFailure(500, 'PUBLISHED_INDEX_VALUES_QUERY_FAILED');

describe('useLatestPublishedIndexValues', () => {
  it('starts loading, then returns the values', async () => {
    const { result } = renderHook(
      () => useLatestPublishedIndexValues(),
      harness(fakeApi({ [LATEST]: values })),
    );

    expect(result.current.state.status).toBe('loading');
    await waitFor(() =>
      expect(result.current.state).toEqual({
        status: 'ready',
        values: values.items,
      }),
    );
  });

  it('is ready with no values before the first import', async () => {
    const { result } = renderHook(
      () => useLatestPublishedIndexValues(),
      harness(fakeApi({ [LATEST]: { items: [] } })),
    );

    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'ready', values: [] }),
    );
  });

  it('reports a failure and recovers on retry', async () => {
    let attempts = 0;
    const { result } = renderHook(
      () => useLatestPublishedIndexValues(),
      harness(
        fakeApi({
          [LATEST]: () => {
            attempts += 1;
            return attempts === 1 ? FAILURE() : values;
          },
        }),
      ),
    );

    await waitFor(() =>
      expect(result.current.state).toEqual({
        status: 'error',
        retrying: false,
      }),
    );

    act(() => result.current.retry());

    await waitFor(() => expect(result.current.state.status).toBe('ready'));
  });
});

describe('useRateReferenceHint', () => {
  // Reads the hint once the values settled, since it is also null while loading.
  async function settledHint(
    kind: RemunerationKind,
    latestRoute: unknown,
  ): Promise<string | null> {
    const { result } = renderHook(
      () => ({
        status: useLatestPublishedIndexValues().state.status,
        hint: useRateReferenceHint(kind),
      }),
      harness(fakeApi({ [LATEST]: latestRoute })),
    );
    await waitFor(() => expect(result.current.status).not.toBe('loading'));
    return result.current.hint;
  }

  it.each([
    ['PREFIXED', 'CDI em 03/11/2026: 13,65% a.a.'],
    ['CDI_PERCENTAGE', 'CDI em 03/11/2026: 13,65% a.a.'],
    ['SELIC_PERCENTAGE', 'SELIC em 04/11/2026: 13,66% a.a.'],
  ] as const)('names the reference of %s', async (kind, hint) => {
    expect(await settledHint(kind, values)).toBe(hint);
  });

  it('has no hint for a kind without a published index', async () => {
    expect(await settledHint('IPCA_PLUS', values)).toBeNull();
  });

  it('has no hint while the index has no value', async () => {
    expect(await settledHint('CDI_PERCENTAGE', { items: [] })).toBeNull();
  });

  it('has no hint when the read fails', async () => {
    expect(await settledHint('CDI_PERCENTAGE', FAILURE)).toBeNull();
  });
});
