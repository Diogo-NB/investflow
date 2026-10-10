import { EconomicIndex } from '../index-curves/economic-index.enum';
import { prepareIndexPercentageAccrual } from './index-percentage-accrual';
import {
  PrepareRemunerationInput,
  RemunerationStrategy,
} from './remuneration-strategy.contract';

export class SelicPercentageRemunerationStrategy
  implements RemunerationStrategy
{
  readonly kind = 'SELIC_PERCENTAGE';

  prepare(input: PrepareRemunerationInput) {
    return prepareIndexPercentageAccrual(input, EconomicIndex.SELIC);
  }
}
