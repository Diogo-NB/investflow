/// <reference types='vitest' />
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/web',
  // Port 4200 is the origin registered in the local Keycloak realm (WEB_APP_ORIGIN).
  server: {
    port: 4200,
    host: 'localhost',
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  preview: {
    port: 4200,
    host: 'localhost',
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  plugins: [react(), tailwindcss(), nxViteTsPaths()],
  build: {
    outDir: '../../dist/apps/web',
    emptyOutDir: true,
    reportCompressedSize: true,
  },
  test: {
    name: 'web',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.{ts,tsx}'],
    reporters: ['default'],
  },
}));
