import type { WebEnvironment } from './environment.type';

export const productionEnvironment: WebEnvironment = {
  keycloak: {
    url: 'https://auth.diogo-nb.com.br',
    realm: 'investflow',
    clientId: 'investflow-web',
  },
};
