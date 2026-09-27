import { WebEnvironment } from './environment.type';

export const environment: WebEnvironment = {
  production: true,
  keycloak: {
    url: 'https://login.example.com',
    realm: 'investflow',
    clientId: 'investflow-web',
  },
};
