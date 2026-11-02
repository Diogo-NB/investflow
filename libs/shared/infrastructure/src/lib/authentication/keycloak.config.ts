import { ConfigType } from '@nestjs/config';
import { z } from 'zod';
import { environmentConfig } from '../config/environment-config';

const keycloakEnvironment = z.object({
  KEYCLOAK_URL: z.url({ protocol: /^https?$/ }),
  KEYCLOAK_REALM: z.string().min(1),
  KEYCLOAK_CLIENT_ID: z.string().min(1),
});

export const keycloakConfig = environmentConfig(
  'keycloak',
  keycloakEnvironment,
  (environment) => ({
    url: environment.KEYCLOAK_URL,
    realm: environment.KEYCLOAK_REALM,
    clientId: environment.KEYCLOAK_CLIENT_ID,
  }),
);

export type KeycloakConfig = ConfigType<typeof keycloakConfig>;
