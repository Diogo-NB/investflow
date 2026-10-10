import { IsUUID } from 'class-validator';

export class SimulationRunIdRequest {
  @IsUUID()
  runId!: string;
}
