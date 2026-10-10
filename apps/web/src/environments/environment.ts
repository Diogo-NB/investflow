import { developmentEnvironment } from './environment.development';
import { productionEnvironment } from './environment.production';

// Vite replaces the mode at build time, so each bundle keeps only one configuration.
export const environment =
  import.meta.env.MODE === 'production'
    ? productionEnvironment
    : developmentEnvironment;
