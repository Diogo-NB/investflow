import type { WebEnvironment } from './environment.type';

export const developmentEnvironment: WebEnvironment = {
  keycloak: {
    url: 'http://localhost:8080',
    realm: 'investflow',
    clientId: 'investflow-web',
  },
};
