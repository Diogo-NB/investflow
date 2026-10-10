/// <reference types='vitest' />
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Test-only configuration: the web app's Vite build bundles this library.
export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/libs/investment-simulator/web',
  plugins: [react(), nxViteTsPaths()],
  test: {
    name: 'investment-simulator-web',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.{ts,tsx}'],
    reporters: ['default'],
  },
}));
