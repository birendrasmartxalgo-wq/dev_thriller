# Dev Thriller

> A case-file team chat. Mono meta, warm paper, hash-chained audit log. Built for studios that ship.

[![CI](https://img.shields.io/badge/ci-pending-lightgrey)](#)

## Stack

- **Backend** — Bun + Elysia, MongoDB (Atlas Search), DragonflyDB (Redis-wire), Cloudflare R2 for blobs, generic SMTP for transactional email.
- **Frontend** — React 19.2 + Vite + TypeScript. Eden Treaty drives end-to-end type inference against the Elysia `App` type; TanStack Query for caching; Zustand for session state.
- **Workers** — Bun scripts: retention sweep, audit-chain verifier, media-extract, thumbnailer.
- **Shared** — `packages/shared` re-exports the backend `App` type so the frontend has zero coupling to backend runtime code.

## Quick start

```bash
bun install
docker compose up -d                  # mongo + dragonfly
bun run dev                           # backend on :3001, frontend on :5173, workers idle
```

Open [http://localhost:5173](http://localhost:5173). Backend Swagger is at [http://localhost:3001/docs](http://localhost:3001/docs).

Seed an end-to-end test workspace:

```bash
bun run --cwd apps/backend seed:e2e
```

## Repo layout

```
apps/
  backend/     Elysia API + WS bus. See apps/backend/README.md
  frontend/    React app. See apps/frontend/README.md
  workers/     Cron-able Bun scripts (retention, audit-verify, thumbnailer, media-extract)
packages/
  shared/      Type-only bridge — re-exports the backend `App` type
deploy/        Docker + Caddy + K8s manifests. See deploy/README.md
preview/       Static design-system preview cards
ui_kits/       Pixel-level HTML/JSX recreations (web + mobile)
```

## Pointers

- **Product spec** — [PRD.md](PRD.md). Feature surface, data model, voice rules.
- **Design system** — [SKILL.md](SKILL.md). Colors, type, motion, content tone. Tokens live in `colors_and_type.css` (do not edit; tokens flow into apps via CSS imports).
- **Deployment** — [deploy/README.md](deploy/README.md). VPS-with-Compose and Kubernetes both supported off the same Dockerfiles.

## Voice

`case` / `cut` / `chunk` / `lock`. Mono meta uses `·` as the separator (`CASE · 0142`). Sentence case for buttons. No exclamation marks. See [SKILL.md](SKILL.md) for the full rules.
