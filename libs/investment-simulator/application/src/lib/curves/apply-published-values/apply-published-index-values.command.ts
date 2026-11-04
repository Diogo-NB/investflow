import {
  EEconomicIndex,
  IndexValue,
  PublishedCurveValue,
} from '@investflow/investment-simulator-domain';
import { CalendarDate } from '@investflow/shared-domain';

export type PublishedCurveIndex = EEconomicIndex.CDI | EEconomicIndex.SELIC;

const CURVE_INDEXES: Readonly<Record<'CDI' | 'SELIC', PublishedCurveIndex>> = {
  CDI: EEconomicIndex.CDI,
  SELIC: EEconomicIndex.SELIC,
};

export interface ApplyPublishedIndexValuesCommandInput {
  readonly index: 'CDI' | 'SELIC';
  readonly values: readonly {
    readonly referenceDate: string;
    readonly value: string;
  }[];
}

export class ApplyPublishedIndexValuesCommand {
  private constructor(
    readonly index: PublishedCurveIndex,
    readonly values: readonly PublishedCurveValue[],
  ) {}

  static fromRequest(
    request: ApplyPublishedIndexValuesCommandInput,
  ): ApplyPublishedIndexValuesCommand {
    return new ApplyPublishedIndexValuesCommand(
      CURVE_INDEXES[request.index],
      request.values.map(({ referenceDate, value }) => ({
        referenceDate: CalendarDate.of(referenceDate),
        value: IndexValue.of(value),
      })),
    );
  }
}
