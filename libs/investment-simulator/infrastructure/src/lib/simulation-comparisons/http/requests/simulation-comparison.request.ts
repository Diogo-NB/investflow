import { SimulationComparison } from '@investflow/investment-simulator-domain';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsUUID,
} from 'class-validator';
import { GetSimulationComparisonQuery } from '../../queries/get-simulation-comparison.query-handler';

export class SimulationComparisonRequest
  implements Omit<GetSimulationComparisonQuery, 'ownerId'>
{
  // Sent comma-separated: ids=a,b,c.
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',') : value,
  )
  @IsArray()
  @ArrayMinSize(SimulationComparison.MIN_SIMULATIONS)
  @ArrayMaxSize(SimulationComparison.MAX_SIMULATIONS)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  ids!: string[];
}
