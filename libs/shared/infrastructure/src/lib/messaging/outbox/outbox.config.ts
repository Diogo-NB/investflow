import { ConfigType } from '@nestjs/config';
import { z } from 'zod';
import { environmentConfig } from '../../config/environment-config';

const wholeSeconds = z.coerce.number().int().min(1);

export const outboxEnvironment = z
  .object({
    OUTBOX_POLL_MIN_INTERVAL_SECONDS: wholeSeconds.default(1),
    OUTBOX_POLL_MAX_INTERVAL_SECONDS: wholeSeconds.default(60),
    OUTBOX_RETENTION_INTERVAL_SECONDS: wholeSeconds.default(21_600),
    OUTBOX_RETENTION_DAYS: wholeSeconds.default(7),
  })
  .refine(
    (environment) =>
      environment.OUTBOX_POLL_MAX_INTERVAL_SECONDS >=
      environment.OUTBOX_POLL_MIN_INTERVAL_SECONDS,
    {
      message: 'must be at least OUTBOX_POLL_MIN_INTERVAL_SECONDS',
      path: ['OUTBOX_POLL_MAX_INTERVAL_SECONDS'],
    },
  );

export const outboxConfig = environmentConfig(
  'outbox',
  outboxEnvironment,
  (environment) => ({
    pollMinIntervalMs: environment.OUTBOX_POLL_MIN_INTERVAL_SECONDS * 1_000,
    pollMaxIntervalMs: environment.OUTBOX_POLL_MAX_INTERVAL_SECONDS * 1_000,
    retentionIntervalMs: environment.OUTBOX_RETENTION_INTERVAL_SECONDS * 1_000,
    retentionMs: environment.OUTBOX_RETENTION_DAYS * 24 * 60 * 60_000,
  }),
);

export type OutboxConfig = ConfigType<typeof outboxConfig>;
