import { EEconomicIndex } from '@investflow/investment-simulator-domain';

export interface CurveIntervalCommandInput {
  readonly startDate: string;
  readonly endDate: string;
  readonly value: string;
}

export interface CreateCurveCommandInput {
  readonly index: EEconomicIndex;
  readonly name: string;
  readonly description?: string | null;
  readonly intervals: readonly CurveIntervalCommandInput[];
}

export interface EditCurveCommandInput {
  readonly revision: number;
  readonly name?: string;
  readonly description?: string | null;
  readonly intervals?: readonly CurveIntervalCommandInput[];
}

export interface CurveIdCommandInput {
  readonly curveId: string;
}
