# Dev Thriller frontend — Vite build → nginx:alpine serving the SPA + proxying /v1 + /v1/ws.
# Build: docker build -t dt-frontend -f apps/frontend/Dockerfile .
# Run:   docker run -p 80:80 -e BACKEND_UPSTREAM=http://dt-backend:3001 dt-frontend

# ---------- build
FROM oven/bun:1.3-alpine AS build
WORKDIR /app
COPY package.json bun.lock tsconfig.base.json ./
COPY colors_and_type.css ./
COPY app/app.css ./app/
COPY assets ./assets
COPY apps/frontend/package.json apps/frontend/
RUN bun install --frozen-lockfile
COPY apps/frontend ./apps/frontend
RUN cd apps/frontend && bun run build

# ---------- runtime
FROM nginx:1.27-alpine AS runtime
RUN rm /etc/nginx/conf.d/default.conf
COPY apps/frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html

ENV BACKEND_UPSTREAM=http://backend:3001

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
