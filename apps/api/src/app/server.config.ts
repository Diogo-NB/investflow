import { ConfigType } from '@nestjs/config';
import { z } from 'zod';
import { environmentConfig } from '@investflow/shared-infrastructure';

const serverEnvironment = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(3_000),
});

export const serverConfig = environmentConfig(
  'server',
  serverEnvironment,
  (environment) => ({ port: environment.PORT }),
);

export type ServerConfig = ConfigType<typeof serverConfig>;
