import { ConfigType } from '@nestjs/config';
import { z } from 'zod';
import { environmentConfig } from '../config/environment-config';

export enum EExperimentMessageFault {
  NONE = 'none',
  DEAD_LETTER = 'dead-letter',
  DUPLICATE = 'duplicate',
  REJECT_UNTIL_NEWER = 'reject-until-newer',
}

const EXPERIMENT_BUS_SUFFIX = '-homolog';

const flag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const experimentSwitches = z.object({
  EXPERIMENT_MESSAGE_FAULT: z
    .enum(EExperimentMessageFault)
    .default(EExperimentMessageFault.NONE),
  EXPERIMENT_TARGET_AGGREGATE_ID: z.string().min(1).optional(),
  EXPERIMENT_TARGET_EVENT_TYPE: z.string().min(1).optional(),
  EXPERIMENT_TARGET_ORDINAL: z.coerce.number().int().min(1).default(1),
  EXPERIMENT_SKIP_DEDUPLICATION: flag,
  EXPERIMENT_SKIP_REVISION_GUARD: flag,
  EXPERIMENT_LOGIC_ERROR: flag,
  EVENT_BUS_NAME: z.string().min(1).optional(),
  // Read only to recognize the local emulator: production never sets it, so
  // a switch can be on only against Floci or the homolog bus.
  AWS_ENDPOINT_URL: z.string().min(1).optional(),
});

function isAnySwitchOn(
  environment: z.output<typeof experimentSwitches>,
): boolean {
  return (
    environment.EXPERIMENT_MESSAGE_FAULT !== EExperimentMessageFault.NONE ||
    environment.EXPERIMENT_SKIP_DEDUPLICATION ||
    environment.EXPERIMENT_SKIP_REVISION_GUARD ||
    environment.EXPERIMENT_LOGIC_ERROR
  );
}

export const experimentsEnvironment = experimentSwitches
  .refine(
    (environment) =>
      environment.EXPERIMENT_MESSAGE_FAULT === EExperimentMessageFault.NONE ||
      (environment.EXPERIMENT_TARGET_AGGREGATE_ID !== undefined &&
        environment.EXPERIMENT_TARGET_EVENT_TYPE !== undefined),
    {
      path: ['EXPERIMENT_TARGET_AGGREGATE_ID'],
      message:
        'A message fault needs EXPERIMENT_TARGET_AGGREGATE_ID and EXPERIMENT_TARGET_EVENT_TYPE',
    },
  )
  .refine(
    (environment) =>
      !isAnySwitchOn(environment) ||
      environment.AWS_ENDPOINT_URL !== undefined ||
      environment.EVENT_BUS_NAME?.endsWith(EXPERIMENT_BUS_SUFFIX) === true,
    {
      path: ['EVENT_BUS_NAME'],
      message: `Experiment switches run only against Floci or a bus ending in ${EXPERIMENT_BUS_SUFFIX}`,
    },
  );

export interface ExperimentTarget {
  readonly aggregateId: string;
  readonly eventType: string;
  readonly ordinal: number;
}

export const experimentsConfig = environmentConfig(
  'experiments',
  experimentsEnvironment,
  (environment) => ({
    messageFault: environment.EXPERIMENT_MESSAGE_FAULT,
    target:
      environment.EXPERIMENT_TARGET_AGGREGATE_ID &&
      environment.EXPERIMENT_TARGET_EVENT_TYPE
        ? {
            aggregateId: environment.EXPERIMENT_TARGET_AGGREGATE_ID,
            eventType: environment.EXPERIMENT_TARGET_EVENT_TYPE,
            ordinal: environment.EXPERIMENT_TARGET_ORDINAL,
          }
        : undefined,
    isDeduplicationSkipped: environment.EXPERIMENT_SKIP_DEDUPLICATION,
    isRevisionGuardSkipped: environment.EXPERIMENT_SKIP_REVISION_GUARD,
    hasLogicError: environment.EXPERIMENT_LOGIC_ERROR,
  }),
);

export type ExperimentsConfig = ConfigType<typeof experimentsConfig>;
