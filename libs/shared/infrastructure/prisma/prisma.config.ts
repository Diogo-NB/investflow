import path from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config();
// The seed runs without a shell, so its TypeScript project is passed through
// the environment it inherits.
process.env['SWC_NODE_PROJECT'] ??= 'tools/database/tsconfig.json';

export default defineConfig({
  schema: path.join(__dirname, 'schema.prisma'),
  migrations: {
    seed: 'node -r @swc-node/register tools/database/seed.ts',
  },
  datasource: {
    url: process.env['DATABASE_URL'] ?? '',
  },
});
