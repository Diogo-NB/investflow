import type { WebEnvironment } from './environment.type';

export const productionEnvironment: WebEnvironment = {
  keycloak: {
    url: 'https://login.example.com',
    realm: 'investflow',
    clientId: 'investflow-web',
  },
};
