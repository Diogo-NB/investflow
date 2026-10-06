import path from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config();

export default defineConfig({
  schema: path.join(__dirname, 'schema.prisma'),
  migrations: {
    seed: 'pnpm exec ts-node --project tools/database/tsconfig.json tools/database/seed.ts',
  },
  datasource: {
    url: process.env['DATABASE_URL'] ?? '',
  },
});
