import { IsUUID } from 'class-validator';

export class SimulationCalculationIdRequest {
  @IsUUID()
  calculationId!: string;
}
