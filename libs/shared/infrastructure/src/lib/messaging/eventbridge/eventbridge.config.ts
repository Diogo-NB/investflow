import { ConfigType } from '@nestjs/config';
import { z } from 'zod';
import { environmentConfig } from '../../config/environment-config';

const eventBridgeEnvironment = z.object({
  EVENT_BUS_NAME: z.string().min(1),
});

export const eventBridgeConfig = environmentConfig(
  'eventBridge',
  eventBridgeEnvironment,
  (environment) => ({ eventBusName: environment.EVENT_BUS_NAME }),
);

export type EventBridgeConfig = ConfigType<typeof eventBridgeConfig>;
