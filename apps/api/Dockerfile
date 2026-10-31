# Packages the build that CI tested: run `pnpm nx run api:prune` first, then
# build from the repository root. The image also runs the migrations, so it
# carries the Prisma CLI, its schema engine, and the migrations.

# Prisma picks its schema engine by the OpenSSL it detects, at download and at
# run time; the slim image has the library but not the binary it probes.
FROM node:22.22.1-bookworm-slim AS base
RUN apt-get update && \
  apt-get install -y --no-install-recommends openssl && \
  rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
COPY package.json /tmp/workspace-package.json
RUN corepack enable && \
  corepack prepare "$(node -p "require('/tmp/workspace-package.json').packageManager")" --activate
COPY dist/apps/api/package.json dist/apps/api/pnpm-lock.yaml ./
COPY dist/apps/api/workspace_modules ./workspace_modules
RUN pnpm install --prod --frozen-lockfile
COPY libs/shared/infrastructure/prisma ./prisma
RUN pnpm exec prisma generate --config=prisma/prisma.config.ts

FROM base
WORKDIR /app
ENV NODE_ENV=production \
  CHECKPOINT_DISABLE=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY libs/shared/infrastructure/prisma ./prisma
COPY dist/apps/api ./
USER node
EXPOSE 3000
CMD ["node", "main.js"]
