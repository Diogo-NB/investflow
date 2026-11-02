import { ConfigType } from '@nestjs/config';
import { z } from 'zod';
import { environmentConfig } from '../../config/environment-config';

const databaseEnvironment = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

export const databaseConfig = environmentConfig(
  'database',
  databaseEnvironment,
  (environment) => ({ url: environment.DATABASE_URL }),
);

export type DatabaseConfig = ConfigType<typeof databaseConfig>;
