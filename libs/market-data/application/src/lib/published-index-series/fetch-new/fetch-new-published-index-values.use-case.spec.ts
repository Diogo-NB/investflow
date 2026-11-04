import {
  EPublishedIndex,
  PublishedIndexSeries,
  PublishedIndexValue,
} from '@investflow/market-data-domain';
import { Clock } from '@investflow/shared-application';
import {
  AppError,
  CalendarDate,
  CalendarDateRange,
  EAppErrorCode,
  Result,
  UtcInstant,
} from '@investflow/shared-domain';
import Decimal from 'decimal.js';
import {
  PublishedIndexSeriesNotFoundError,
  PublishedIndexValuesFetchError,
} from '../published-index-series.error';
import { PublishedIndexSeriesRepository } from '../published-index-series.repository';
import { PublishedIndexValuesReader } from '../published-index-values-reader.port';
import { FetchNewPublishedIndexValuesCommand } from './fetch-new-published-index-values.command';
import { FetchNewPublishedIndexValuesUseCase } from './fetch-new-published-index-values.use-case';

const today = CalendarDate.of('2027-01-05');

function published(date: string): PublishedIndexValue {
  return PublishedIndexValue.of(CalendarDate.of(date), new Decimal('0.1365'));
}

function seriesEndingOn(date: string): PublishedIndexSeries {
  return PublishedIndexSeries.reconstitute({
    id: 'series-1',
    index: EPublishedIndex.CDI,
    year: CalendarDate.of(date).year,
    revision: 1,
    values: [published(date)],
  });
}

function createFixture(
  latest: Result<PublishedIndexSeries, AppError>,
  fetched: readonly PublishedIndexValue[] = [],
) {
  const repository = {
    findLatest: jest.fn().mockResolvedValue(latest),
  } as unknown as PublishedIndexSeriesRepository;
  const fetchBetween = jest.fn().mockResolvedValue(Result.ok(fetched));
  const reader = { fetchBetween } as unknown as PublishedIndexValuesReader;
  const clock: Clock = {
    now: () => UtcInstant.ofIso('2027-01-05T13:00:00.000Z'),
    today: () => today,
  };
  return {
    useCase: new FetchNewPublishedIndexValuesUseCase(repository, reader, clock),
    fetchBetween,
  };
}

const notFound = Result.err<PublishedIndexSeries>(
  new PublishedIndexSeriesNotFoundError({ index: EPublishedIndex.CDI }),
);
const command = (startDate: string | null = null) =>
  FetchNewPublishedIndexValuesCommand.of(
    EPublishedIndex.CDI,
    startDate ? CalendarDate.of(startDate) : null,
  );

describe('FetchNewPublishedIndexValuesUseCase', () => {
  it('resumes the day after the last stored date, through today', async () => {
    const { useCase, fetchBetween } = createFixture(
      Result.ok(seriesEndingOn('2026-11-03')),
    );

    await useCase.execute(command());

    expect(fetchBetween).toHaveBeenCalledWith({
      index: EPublishedIndex.CDI,
      range: CalendarDateRange.of(CalendarDate.of('2026-11-04'), today),
    });
  });

  it('starts on the given date when the index has no series', async () => {
    const { useCase, fetchBetween } = createFixture(notFound);

    await useCase.execute(command('2026-10-31'));

    expect(fetchBetween.mock.calls[0][0].range.start).toEqual(
      CalendarDate.of('2026-10-31'),
    );
  });

  it('starts on the given date when a series exists', async () => {
    const { useCase, fetchBetween } = createFixture(
      Result.ok(seriesEndingOn('2026-11-03')),
    );

    await useCase.execute(command('2026-11-10'));

    expect(fetchBetween.mock.calls[0][0].range.start).toEqual(
      CalendarDate.of('2026-11-10'),
    );
  });

  it('fails without calling the reader when no date is given and no value is stored', async () => {
    const { useCase, fetchBetween } = createFixture(notFound);

    const result = await useCase.execute(command());

    expect(result.error.code).toBe(
      EAppErrorCode.PUBLISHED_INDEX_IMPORT_START_DATE_MISSING,
    );
    expect(fetchBetween).not.toHaveBeenCalled();
  });

  it('returns no batches without calling the reader once today is stored', async () => {
    const { useCase, fetchBetween } = createFixture(
      Result.ok(seriesEndingOn('2027-01-05')),
    );

    const result = await useCase.execute(command());

    expect(result.value).toEqual([]);
    expect(fetchBetween).not.toHaveBeenCalled();
  });

  it('returns no batches without calling the reader for a future start date', async () => {
    const { useCase, fetchBetween } = createFixture(notFound);

    const result = await useCase.execute(command('2027-01-06'));

    expect(result.value).toEqual([]);
    expect(fetchBetween).not.toHaveBeenCalled();
  });

  it('returns one batch per year, oldest first', async () => {
    const values = ['2026-12-30', '2026-12-31', '2027-01-04'].map(published);
    const { useCase } = createFixture(
      Result.ok(seriesEndingOn('2026-12-29')),
      values,
    );

    const result = await useCase.execute(command());

    expect(result.value).toEqual([
      {
        index: EPublishedIndex.CDI,
        year: 2026,
        values: values.slice(0, 2),
      },
      { index: EPublishedIndex.CDI, year: 2027, values: values.slice(2) },
    ]);
  });

  it('returns no batches when nothing new was published', async () => {
    const { useCase } = createFixture(Result.ok(seriesEndingOn('2026-12-29')));

    const result = await useCase.execute(command());

    expect(result.value).toEqual([]);
  });

  it('returns the failure of a lookup or a fetch', async () => {
    const failure = new PublishedIndexValuesFetchError(
      EPublishedIndex.CDI,
      new Error('boom'),
    );
    const lookupFailed = createFixture(Result.err(failure));
    expect((await lookupFailed.useCase.execute(command())).error).toBe(failure);

    const fetchFailed = createFixture(Result.ok(seriesEndingOn('2026-12-29')));
    fetchFailed.fetchBetween.mockResolvedValue(Result.err(failure));
    expect((await fetchFailed.useCase.execute(command())).error).toBe(failure);
  });
});
