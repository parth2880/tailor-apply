# Persistent API host (Railway / Render / Fly / Docker).
# LinkedIn Find jobs + SQLite + Chromium. Do not use Vercel for this service.

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
COPY data/master_resume.yaml data/master_resume.md data/
WORKDIR /app/apps/api
RUN pnpm exec prisma generate && pnpm run build

FROM base AS runner
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001
ENV HEADLESS=true
ENV DATA_DIR=/data
ENV DATABASE_URL=file:/data/app.db
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/config ./config
COPY --from=build /app/data ./data
WORKDIR /app/apps/api
RUN pnpm exec playwright install --with-deps chromium
EXPOSE 3001
CMD ["node", "dist/main.js"]
