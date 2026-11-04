export const PUBLISHED_INDEX_VALUES_IMPORTED = 'PublishedIndexValuesImported';

export interface PublishedIndexValuesImportedContract {
  readonly eventId: string;
  readonly eventType: typeof PUBLISHED_INDEX_VALUES_IMPORTED;
  readonly version: number;
  readonly context: 'market-data';
  readonly aggregateType: 'PublishedIndexSeries';
  readonly aggregateId: string;
  readonly occurredAt: string;
  readonly index: 'CDI' | 'SELIC' | 'SELIC_TARGET';
  // Oldest first. A value is a decimal string in fractions: 13.65% is 0.1365.
  readonly values: readonly {
    readonly referenceDate: string;
    readonly value: string;
  }[];
}
