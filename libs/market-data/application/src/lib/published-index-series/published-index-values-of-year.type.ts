import {
  EPublishedIndex,
  PublishedIndexValue,
} from '@investflow/market-data-domain';

export interface PublishedIndexValuesOfYear {
  readonly index: EPublishedIndex;
  readonly year: number;
  readonly values: readonly PublishedIndexValue[];
}
