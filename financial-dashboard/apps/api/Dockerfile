# syntax=docker/dockerfile:1
# Build context: repo root (Railway default)
FROM node:20-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy workspace manifests first — better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install all deps (devDeps needed for tsc)
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Build: shared first, then generate Prisma client, then compile API
RUN pnpm --filter @fin/shared build \
 && pnpm --filter @fin/api db:generate \
 && pnpm --filter @fin/api build

ENV NODE_ENV=production
EXPOSE 3001

# Note: run migrations as a one-time Railway pre-deploy command:
#   pnpm --filter @fin/api db:migrate:deploy
CMD ["node", "apps/api/dist/index.js"]
