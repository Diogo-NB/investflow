import {
  CalendarDate,
  EAppErrorCode,
  UtcInstant,
} from '@investflow/shared-domain';
import Decimal from 'decimal.js';
import { EPublishedIndex } from './published-index.enum';
import { PublishedIndexValue } from './published-index-value.vo';
import { PublishedIndexSeries } from './published-index-series.aggregate';
import { PublishedIndexValuesImported } from './published-index-series.events';

const occurredAt = UtcInstant.ofIso('2026-11-04T13:00:00.000Z');

function published(date: string, value = '0.1365'): PublishedIndexValue {
  return PublishedIndexValue.of(CalendarDate.of(date), new Decimal(value));
}

describe('PublishedIndexSeries', () => {
  it('starts empty, with no last date', () => {
    const series = PublishedIndexSeries.create(EPublishedIndex.CDI, 2026);

    expect(series.values).toEqual([]);
    expect(series.lastReferenceDate).toBeNull();
    expect(series.getDomainEvents()).toEqual([]);
  });

  it('appends values and raises one event carrying them', () => {
    const series = PublishedIndexSeries.create(EPublishedIndex.CDI, 2026);

    const result = series.append(
      [published('2026-11-03'), published('2026-11-04', '0.14')],
      occurredAt,
    );

    expect(result.isOk()).toBe(true);
    expect(series.lastReferenceDate?.toIsoString()).toBe('2026-11-04');
    const events = series.getDomainEvents();
    expect(events).toHaveLength(1);
    const event = events[0] as PublishedIndexValuesImported;
    expect(event).toBeInstanceOf(PublishedIndexValuesImported);
    expect(event.aggregateId).toBe(series.id);
    expect(event.context).toBe('market-data');
    expect(event.index).toBe('CDI');
    expect(event.values).toEqual([
      { referenceDate: '2026-11-03', value: '0.1365' },
      { referenceDate: '2026-11-04', value: '0.14' },
    ]);
  });

  it('takes one new revision per append', () => {
    const series = PublishedIndexSeries.reconstitute({
      id: 'series-1',
      index: EPublishedIndex.SELIC,
      year: 2026,
      revision: 3,
      values: [published('2026-11-03')],
    });

    series.append([published('2026-11-04')], occurredAt);

    expect(series.revision).toBe(4);
  });

  it('rejects a value from another year and appends nothing', () => {
    const series = PublishedIndexSeries.create(EPublishedIndex.CDI, 2026);

    const result = series.append(
      [published('2026-12-30'), published('2027-01-04')],
      occurredAt,
    );

    expect(result.error.code).toBe(EAppErrorCode.PUBLISHED_INDEX_VALUE_INVALID);
    expect(series.values).toEqual([]);
    expect(series.getDomainEvents()).toEqual([]);
  });

  it.each(['2026-11-03', '2026-11-02'])(
    'rejects %s, not after the last date',
    (date) => {
      const series = PublishedIndexSeries.create(EPublishedIndex.CDI, 2026);
      series.append([published('2026-11-03')], occurredAt);

      const result = series.append([published(date)], occurredAt);

      expect(result.error.code).toBe(
        EAppErrorCode.PUBLISHED_INDEX_VALUE_INVALID,
      );
      expect(series.values).toHaveLength(1);
    },
  );

  it('rejects values out of order within one append', () => {
    const series = PublishedIndexSeries.create(EPublishedIndex.CDI, 2026);

    const result = series.append(
      [published('2026-11-04'), published('2026-11-03')],
      occurredAt,
    );

    expect(result.isErr()).toBe(true);
  });
});
