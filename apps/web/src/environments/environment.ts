import { WebEnvironment } from './environment.type';

export const environment: WebEnvironment = {
  production: false,
  keycloak: {
    url: 'http://localhost:8080',
    realm: 'investflow',
    clientId: 'investflow-web',
  },
};
