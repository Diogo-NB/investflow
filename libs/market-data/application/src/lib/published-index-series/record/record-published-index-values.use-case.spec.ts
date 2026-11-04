import {
  EPublishedIndex,
  PublishedIndexSeries,
  PublishedIndexValue,
} from '@investflow/market-data-domain';
import { Clock } from '@investflow/shared-application';
import {
  AppError,
  CalendarDate,
  EAppErrorCode,
  Result,
  UtcInstant,
} from '@investflow/shared-domain';
import Decimal from 'decimal.js';
import { PublishedIndexSeriesNotFoundError } from '../published-index-series.error';
import { PublishedIndexSeriesRepository } from '../published-index-series.repository';
import { RecordPublishedIndexValuesCommand } from './record-published-index-values.command';
import { RecordPublishedIndexValuesUseCase } from './record-published-index-values.use-case';

function published(date: string): PublishedIndexValue {
  return PublishedIndexValue.of(CalendarDate.of(date), new Decimal('0.1365'));
}

function createFixture(found: Result<PublishedIndexSeries, AppError>) {
  const save = jest.fn().mockResolvedValue(Result.ok(undefined));
  const repository = {
    findByIndexAndYear: jest.fn().mockResolvedValue(found),
    save,
  } as unknown as PublishedIndexSeriesRepository;
  const clock: Clock = {
    now: () => UtcInstant.ofIso('2026-11-04T13:00:00.000Z'),
    today: () => CalendarDate.of('2026-11-04'),
  };
  return {
    useCase: new RecordPublishedIndexValuesUseCase(repository, clock),
    save,
  };
}

const command = (...dates: string[]) =>
  RecordPublishedIndexValuesCommand.of({
    index: EPublishedIndex.CDI,
    year: 2026,
    values: dates.map(published),
  });

describe('RecordPublishedIndexValuesUseCase', () => {
  it('creates the series of a year it has not seen', async () => {
    const { useCase, save } = createFixture(
      Result.err(new PublishedIndexSeriesNotFoundError({ year: 2026 })),
    );

    const result = await useCase.execute(command('2026-11-03'));

    expect(result.isOk()).toBe(true);
    const saved: PublishedIndexSeries = save.mock.calls[0][0];
    expect(saved.index).toBe(EPublishedIndex.CDI);
    expect(saved.year).toBe(2026);
    expect(saved.values).toHaveLength(1);
  });

  it('appends to the series it finds', async () => {
    const series = PublishedIndexSeries.reconstitute({
      id: 'series-1',
      index: EPublishedIndex.CDI,
      year: 2026,
      revision: 1,
      values: [published('2026-11-03')],
    });
    const { useCase, save } = createFixture(Result.ok(series));

    await useCase.execute(command('2026-11-04'));

    expect(save).toHaveBeenCalledWith(series);
    expect(series.values).toHaveLength(2);
  });

  it('saves nothing when the values are rejected', async () => {
    const series = PublishedIndexSeries.reconstitute({
      id: 'series-1',
      index: EPublishedIndex.CDI,
      year: 2026,
      revision: 1,
      values: [published('2026-11-03')],
    });
    const { useCase, save } = createFixture(Result.ok(series));

    const result = await useCase.execute(command('2026-11-03'));

    expect(result.error.code).toBe(EAppErrorCode.PUBLISHED_INDEX_VALUE_INVALID);
    expect(save).not.toHaveBeenCalled();
  });
});
