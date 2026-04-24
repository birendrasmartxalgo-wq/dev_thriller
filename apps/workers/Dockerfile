# Unified workers image. One image, one entrypoint, one WORKER env var picks
# which script to run. Keeps the deploy matrix simple.
#
# Supported values for WORKER:
#   retention      — one-shot retention reaper (CronJob)
#   audit-verify   — one-shot audit-log chain verifier (CronJob)
#   media-extract  — one-shot chat_media backfill
#   thumbnailer    — long-running thumbnail worker (Deployment)
#
# We install ffmpeg from Alpine because the thumbnailer shells out via
# fluent-ffmpeg. It's ~25 MB — far slimmer than bundling @ffmpeg-installer.

FROM oven/bun:1.3-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy the workspace manifests first so Bun can cache installs.
COPY package.json bun.lockb* ./
COPY apps/backend/package.json apps/backend/
COPY apps/workers/package.json apps/workers/

RUN bun install --frozen-lockfile || bun install

# Copy sources.
COPY apps/backend apps/backend
COPY apps/workers apps/workers
COPY tsconfig.base.json ./

ENV NODE_ENV=production
ENV WORKER=thumbnailer

# Map WORKER -> script path at container start.
CMD ["sh", "-c", "bun run apps/workers/src/${WORKER}.ts"]
