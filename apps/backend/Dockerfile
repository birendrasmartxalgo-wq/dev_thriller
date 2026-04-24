# Dev Thriller backend — multi-stage Bun image.
# Build: docker build -t dt-backend -f apps/backend/Dockerfile .
# Run:   docker run -p 3001:3001 --env-file apps/backend/.env dt-backend

# ---------- deps (cached layer)
FROM oven/bun:1.3-alpine AS deps
WORKDIR /app
COPY package.json bun.lock tsconfig.base.json ./
COPY apps/backend/package.json apps/backend/
RUN bun install --frozen-lockfile --production=false

# ---------- build (typecheck + compile)
FROM deps AS build
WORKDIR /app
COPY apps/backend ./apps/backend
RUN cd apps/backend && bun x tsc --noEmit

# ---------- runtime (minimal)
FROM oven/bun:1.3-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    LOG_LEVEL=info
# Copy only what's needed to run.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=build /app/apps/backend/src ./apps/backend/src
COPY --from=build /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=build /app/apps/backend/tsconfig.json ./apps/backend/tsconfig.json
COPY --from=build /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=build /app/package.json ./package.json

EXPOSE 3001
USER bun
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3001/ready || exit 1

CMD ["bun", "run", "apps/backend/src/index.ts"]
