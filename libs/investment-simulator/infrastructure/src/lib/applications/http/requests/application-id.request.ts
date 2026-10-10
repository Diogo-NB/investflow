import { ApplicationIdCommandInput } from '@investflow/investment-simulator-application';
import { IsUUID } from 'class-validator';

export class ApplicationIdRequest implements ApplicationIdCommandInput {
  @IsUUID()
  applicationId!: string;
}
