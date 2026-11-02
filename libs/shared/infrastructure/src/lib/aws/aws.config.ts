import { ConfigType } from '@nestjs/config';
import { z } from 'zod';
import { environmentConfig } from '../config/environment-config';

// Credentials and AWS_ENDPOINT_URL stay with the SDK's own provider chain,
// which also resolves profiles and IAM Roles Anywhere.
const awsEnvironment = z.object({
  AWS_REGION: z.string().min(1),
});

export const awsConfig = environmentConfig(
  'aws',
  awsEnvironment,
  (environment) => ({ region: environment.AWS_REGION }),
);

export type AwsConfig = ConfigType<typeof awsConfig>;
