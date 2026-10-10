import { SimulationIdCommandInput } from '@investflow/investment-simulator-application';
import { IsUUID } from 'class-validator';

export class SimulationIdRequest implements SimulationIdCommandInput {
  @IsUUID()
  simulationId!: string;
}
