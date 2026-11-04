import {
  EPublishedIndex,
  PublishedIndexValue,
} from '@investflow/market-data-domain';
import { PublishedIndexValuesOfYear } from '../published-index-values-of-year.type';

export class RecordPublishedIndexValuesCommand {
  private constructor(
    readonly index: EPublishedIndex,
    readonly year: number,
    readonly values: readonly PublishedIndexValue[],
  ) {}

  static of(
    batch: PublishedIndexValuesOfYear,
  ): RecordPublishedIndexValuesCommand {
    return new RecordPublishedIndexValuesCommand(
      batch.index,
      batch.year,
      batch.values,
    );
  }
}
