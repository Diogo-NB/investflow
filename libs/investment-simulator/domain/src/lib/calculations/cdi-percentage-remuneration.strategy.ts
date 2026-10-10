import { EconomicIndex } from '../index-curves/economic-index.enum';
import { prepareIndexPercentageAccrual } from './index-percentage-accrual';
import {
  PrepareRemunerationInput,
  RemunerationStrategy,
} from './remuneration-strategy.contract';

export class CdiPercentageRemunerationStrategy implements RemunerationStrategy {
  readonly kind = 'CDI_PERCENTAGE';

  prepare(input: PrepareRemunerationInput) {
    return prepareIndexPercentageAccrual(input, EconomicIndex.CDI);
  }
}
