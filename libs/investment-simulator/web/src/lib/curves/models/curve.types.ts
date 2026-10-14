import type { EconomicIndex } from '../../offers/models/offer-terms';
import type { ContentOrigin } from '../../offers/models/offer.types';

export interface CurveSummary {
  readonly id: string;
  readonly index: EconomicIndex;
  readonly name: string;
  readonly description: string | null;
  readonly origin: ContentOrigin;
  readonly revision: number;
  // First and last covered dates; nothing is missing between them.
  readonly coverage: { readonly startDate: string; readonly endDate: string };
}

export interface CurveInterval {
  readonly startDate: string;
  // Inclusive.
  readonly endDate: string;
  // Decimal fraction in the index's convention: 0.12 is 12% a.a. for CDI and
  // SELIC, 0.004 is 0.4% in the month for IPCA.
  readonly value: string;
}

export interface CurveDetail {
  readonly id: string;
  readonly index: EconomicIndex;
  readonly name: string;
  readonly description: string | null;
  readonly origin: ContentOrigin;
  readonly revision: number;
  // Ordered by start date.
  readonly intervals: readonly CurveInterval[];
}

export interface CurveInput {
  readonly index: EconomicIndex;
  readonly name: string;
  readonly description: string | null;
  readonly intervals: readonly CurveInterval[];
}

// Omitted fields keep their value; a null description clears it.
export type CurveEdit = Partial<Omit<CurveInput, 'index'>> & {
  readonly revision: number;
};
