import { IsUUID } from 'class-validator';
import { CreateApplicationCommandInput } from '@investflow/investment-simulator-application';
import { ReviseApplicationRequest } from './revise-application.request';

export class CreateApplicationRequest
  extends ReviseApplicationRequest
  implements CreateApplicationCommandInput
{
  @IsUUID()
  offerId!: string;
}
