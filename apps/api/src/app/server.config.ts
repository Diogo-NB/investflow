import type { LogLevel } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { z } from 'zod';
import { environmentConfig } from '@investflow/shared-infrastructure';

// Most severe first: a level enables itself and every level before it.
const LOG_LEVELS = [
  'fatal',
  'error',
  'warn',
  'log',
  'debug',
  'verbose',
] as const satisfies readonly LogLevel[];

const serverEnvironment = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(3_000),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('log'),
});

export const serverConfig = environmentConfig(
  'server',
  serverEnvironment,
  (environment) => ({
    port: environment.PORT,
    logLevels: LOG_LEVELS.slice(
      0,
      LOG_LEVELS.indexOf(environment.LOG_LEVEL) + 1,
    ),
  }),
);

export type ServerConfig = ConfigType<typeof serverConfig>;
