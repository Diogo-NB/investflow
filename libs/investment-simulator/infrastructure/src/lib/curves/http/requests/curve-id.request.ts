import { CurveIdCommandInput } from '@investflow/investment-simulator-application';
import { IsUUID } from 'class-validator';

export class CurveIdRequest implements CurveIdCommandInput {
  @IsUUID()
  curveId!: string;
}
