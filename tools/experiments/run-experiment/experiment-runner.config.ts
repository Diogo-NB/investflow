import { ConfigType } from '@nestjs/config';
import { z } from 'zod';
import { environmentConfig } from '@investflow/shared-infrastructure';

// The API declares the consumed queue URLs in SqsConsumersModule; the runner
// reads them again, with the dead-letter queues no consumer reads, to observe
// and redrive them.
const experimentRunnerEnvironment = z.object({
  EXPERIMENT_API_URL: z.url().default('http://localhost:3000/api'),
  EXPERIMENT_KEYCLOAK_USERNAME: z.string().min(1).default('investflow-dev'),
  EXPERIMENT_KEYCLOAK_PASSWORD: z.string().min(1),
  EXPERIMENT_KEYCLOAK_CLIENT_SECRET: z.string().min(1),
  SIMULATION_CALCULATIONS_QUEUE_URL: z.url(),
  SIMULATION_CALCULATIONS_DLQ_URL: z.url(),
  SIMULATION_RECALCULATIONS_QUEUE_URL: z.url(),
  SIMULATION_RECALCULATIONS_DLQ_URL: z.url(),
  CURVE_PUBLISHED_INDEX_VALUES_QUEUE_URL: z.url(),
  CURVE_PUBLISHED_INDEX_VALUES_DLQ_URL: z.url(),
  // Floci has no event delivery dead-letter queue.
  EVENT_DELIVERY_DLQ_URL: z.url().optional(),
});

export const experimentRunnerConfig = environmentConfig(
  'experimentRunner',
  experimentRunnerEnvironment,
  (environment) => ({
    apiUrl: environment.EXPERIMENT_API_URL.replace(/\/$/, ''),
    username: environment.EXPERIMENT_KEYCLOAK_USERNAME,
    password: environment.EXPERIMENT_KEYCLOAK_PASSWORD,
    clientSecret: environment.EXPERIMENT_KEYCLOAK_CLIENT_SECRET,
    queues: {
      calculations: environment.SIMULATION_CALCULATIONS_QUEUE_URL,
      calculationsDeadLetter: environment.SIMULATION_CALCULATIONS_DLQ_URL,
      recalculations: environment.SIMULATION_RECALCULATIONS_QUEUE_URL,
      recalculationsDeadLetter: environment.SIMULATION_RECALCULATIONS_DLQ_URL,
      publishedIndexValues: environment.CURVE_PUBLISHED_INDEX_VALUES_QUEUE_URL,
      publishedIndexValuesDeadLetter:
        environment.CURVE_PUBLISHED_INDEX_VALUES_DLQ_URL,
      eventDeliveryDeadLetter: environment.EVENT_DELIVERY_DLQ_URL ?? null,
    },
  }),
);

export type ExperimentRunnerConfig = ConfigType<typeof experimentRunnerConfig>;
