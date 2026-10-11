import { IsNumberString } from 'class-validator';
import { CurveIntervalCommandInput } from '@investflow/investment-simulator-application';
import { IsCalendarDate } from '@investflow/shared-infrastructure';

export class CurveIntervalRequest implements CurveIntervalCommandInput {
  @IsCalendarDate()
  startDate!: string;

  @IsCalendarDate()
  endDate!: string;

  @IsNumberString({ no_symbols: false })
  value!: string;
}
