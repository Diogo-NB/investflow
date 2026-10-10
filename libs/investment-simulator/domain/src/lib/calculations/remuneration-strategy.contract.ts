import { CalendarDate, Result } from '@investflow/shared-domain';
import Decimal from 'decimal.js';
import { IndexCurve } from '../index-curves/index-curve.aggregate';
import {
  RemunerationKind,
  RemunerationTerms,
} from '../offers/terms/remuneration/remuneration-terms.vo';
import { InvestmentCalculationError } from './investment-calculation.error';

export interface DailyAccrual {
  readonly rateReferenceDate: CalendarDate;
  readonly balanceDate: CalendarDate;
}

export interface PreparedDailyAccrual extends DailyAccrual {
  readonly factor: Decimal;
}

export interface PrepareRemunerationInput {
  readonly terms: RemunerationTerms;
  readonly accruals: readonly DailyAccrual[];
  readonly indexCurve?: IndexCurve;
}

export interface RemunerationStrategy {
  readonly kind: RemunerationKind;
  // Resolve all coverage first; preserve the supplied daily steps and their order.
  prepare(
    input: PrepareRemunerationInput,
  ): Result<readonly PreparedDailyAccrual[], InvestmentCalculationError>;
}
