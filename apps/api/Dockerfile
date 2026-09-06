# Persistent API host (Railway / Render / Fly / Docker). Prefer this over Vercel for
# LinkedIn automation + durable SQLite. Vercel can still run a limited HTTP API.

FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @job-automator/api...

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api apps/api
COPY config config
COPY data data
WORKDIR /app/apps/api
RUN pnpm exec prisma generate && pnpm run build
RUN pnpm exec playwright install --with-deps chromium || true

FROM base AS runner
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/config ./config
COPY --from=build /app/data ./data
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]
