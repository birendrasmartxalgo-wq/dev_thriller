# Dev Thriller — Frontend

React 19.2 + Vite + TypeScript. Eden Treaty drives end-to-end type inference against the backend's `App` type.

## Run + build + e2e

```bash
bun run --cwd apps/frontend dev          # :5173, /v1 + /docs proxied to :3001
bun run --cwd apps/frontend build        # tsc -b + vite build
bun run --cwd apps/frontend typecheck    # tsc --noEmit
bun run --cwd apps/frontend e2e          # full Playwright run (chromium + firefox)
bun run --cwd apps/frontend e2e:list     # list specs without running
```

Playwright requires the backend + a seeded e2e workspace:

```bash
bun run --cwd apps/backend seed:e2e
```

## Eden Treaty

The frontend imports the backend's Elysia `App` type via the type-only `@dt/shared` workspace (`packages/shared/index.ts`):

```ts
import { treaty } from "@elysiajs/eden";
import type { App } from "@dt/shared";

export const eden = treaty<App>(deriveBaseUrl(), { fetcher: authedFetch });
```

This gives us full inference for path, params, query, body, and response on every endpoint — change a `t.Object({...})` schema on the backend and the frontend's `tsc` flags every callsite that still uses the old shape. No code generation step.

`src/api/client.ts` wraps Eden with:

- `tokenStore` — Bearer access + refresh in `localStorage`.
- `authedFetch` — attaches `Authorization`, single-flight refreshes on 401, scrapes `X-Request-Id` into `debugContext`.
- `unwrap(r)` — turns Eden's `{ data, error }` envelope into the success value (or throws an `ApiError`). Returns `unknown` so the per-endpoint wrapper narrows with a single `as <ViewModel>` cast (Eden infers `Date` for timestamps; the wire is `string` — that cast is the bridge).

### Adding a new endpoint wrapper

1. Define / change the route on the backend (see `apps/backend/README.md`).
2. Run `bun run --cwd apps/frontend typecheck` — Eden picks up the new shape without any frontend change.
3. Add a typed wrapper in `src/api/endpoints.ts` (or `src/api/adminApi.ts` for admin-shaped surfaces):

   ```ts
   widget: {
     list: async (workspaceId: string): Promise<{ items: WidgetSummary[] }> => {
       const r = await eden.v1.widgets.get({ query: { workspaceId } });
       return unwrap(r) as { items: WidgetSummary[] };
     },
   }
   ```

4. If the response shape needs a hand-written view model (e.g. timestamps as `string`), declare the interface in `src/api/types.ts`. Otherwise prefer Eden's inferred shape.

### Where types come from

- **Backend response shapes** — inferred by Eden from the backend's `t.Object` schemas. Re-exported as `App` from `@dt/backend` and bridged through `@dt/shared`.
- **View models** — `src/api/types.ts`. Hand-written, kept in sync with the wire reality (timestamps as `string`, IDs as `string`, etc.). The endpoint wrappers narrow Eden's inferred type to these.
- **Domain helpers** — local to each module (e.g. `src/modules/chat/types.ts` if a view needs derived shape).

## Routing

`src/router.tsx` is a custom 100-line pathname router (`Routes`, `match`, `Link`, `useParams`, `navigate`). Routes are declared in `src/App.tsx`. The `/invite/:token` route is intentionally allowed to render unauthenticated; everything else funnels through `RequireAuth`, which redirects to `/login` when there's no booted session.

## State

- **Server state** — `@tanstack/react-query`. Query keys follow `[entity, ...scope]` (e.g. `["chats", workspaceId]`).
- **Client state** — `zustand` stores in `src/store/*`. `useSession` holds the current user, the workspace list, and the active workspace id (persisted to `localStorage` so a refresh doesn't reset the case).

## Testing

- **Unit / component tests** — not yet wired (Phase 7+). Hooks and pure helpers live in `src/lib/` for easy isolation when they land.
- **E2E** — Playwright in `e2e/`. Smoke covers login + send-message and the invite signup flow. Selectors are anchored on `data-testid` so the markup can move without breaking specs.
