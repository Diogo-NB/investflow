import { UtcInstant } from '@investflow/shared-domain';
import { MarketDataEvent } from '../market-data.event';
import { EPublishedIndex } from './published-index.enum';
import { PublishedIndexValue } from './published-index-value.vo';

export class PublishedIndexValuesImported extends MarketDataEvent {
  readonly eventType = 'PublishedIndexValuesImported';
  readonly aggregateType = 'PublishedIndexSeries';
  readonly index: `${EPublishedIndex}`;
  readonly values: readonly {
    readonly referenceDate: string;
    readonly value: string;
  }[];

  constructor(
    seriesId: string,
    index: EPublishedIndex,
    values: readonly PublishedIndexValue[],
    occurredAt: UtcInstant,
  ) {
    super(seriesId, occurredAt);
    this.index = index;
    this.values = values.map((published) => ({
      referenceDate: published.referenceDate.toIsoString(),
      value: published.value.toFixed(),
    }));
  }
}
