# Dev Thriller — Product Requirements Document & System Design Specification

**Author:** Product Architecture  
**Status:** Draft v1  
**Audience:** Product, Backend, Frontend, Infra, Design

> *"A collaboration platform where every project is a case file, every thread is a lead, and every shipped feature closes a chapter."*

Dev Thriller is a team collaboration platform in the spirit of Asana / Slack / Airtable, built for dev-adjacent teams who want the **drama** of a case-file interface with the **precision** of a modern SaaS tool. Core capabilities: workspaces, projects, chat (with 5,000+ message threads), file sharing, media extraction, global search, and chunked uploads up to 1 GB, backed by Cloudflare R2.

---

## 1. Product Overview

Dev Thriller is a single workspace for teams to **talk, share, and track work**. It competes in the intersection of Asana (projects), Slack (chat), and Notion/Dropbox (files). Differentiation is a tight, opinionated information architecture and a distinctive "case file" visual language — every project surfaces as a rich, indexable dossier rather than a flat list of tasks.

### 1.1 Primary jobs-to-be-done

| JTBD | User |
|---|---|
| Spin up a workspace and invite a team in under 2 minutes | Founder / team lead |
| Share a 900 MB video reel with a client without it bouncing | Creative / PM |
| Find "the design spec Rahul linked three weeks ago" in <5 seconds | Any member |
| Revoke a guest's access cleanly when a contract ends | Admin |
| Audit who touched a sensitive file last month | Admin / compliance |

---

## 2. Goals and Non-Goals

### 2.1 Goals
- Unified chat + file + project workspace with a shared permission model.
- Scalable to **10k users / workspace**, **5k+ messages per thread**, **1 GB individual uploads**.
- Sub-200 ms p50 chat fan-out, sub-500 ms p95 search.
- Zero-downtime chunked uploads with resume + integrity checks.
- Cost-efficient storage via Cloudflare R2 (no egress fees).
- RBAC with owner/admin/member/guest + fine-grained resource ACLs.

### 2.2 Non-goals (v1)
- Full task/project management (dependencies, Gantt, workload) — shallow in v1.
- Video conferencing / screen share.
- Client-side end-to-end encryption.
- On-prem deployment.
- Native desktop apps (web + mobile only).

---

## 3. User Roles and Permissions Matrix

| Action | Owner | Admin | Member | Guest |
|---|---|---|---|---|
| Delete workspace | ✅ | ❌ | ❌ | ❌ |
| Manage billing | ✅ | ❌ | ❌ | ❌ |
| Invite / remove users | ✅ | ✅ | ❌ | ❌ |
| Change user roles | ✅ | ✅ | ❌ | ❌ |
| Create project | ✅ | ✅ | ✅ | ❌ |
| Upload files | ✅ | ✅ | ✅ | ⚙️ (per-chat) |
| Comment / react | ✅ | ✅ | ✅ | ✅ |
| Share publicly | ✅ | ✅ | ⚙️ (configurable) | ❌ |
| View audit log | ✅ | ✅ | ❌ | ❌ |
| Set retention policy | ✅ | ✅ | ❌ | ❌ |

Resource-level ACLs override role defaults. Resolution order: **deny > allow > inherit**.

---

## 4. Core Features

1. **Auth & Onboarding** — email/password, Google OAuth, magic-link invites, MFA (TOTP), session JWT + refresh.
2. **Workspaces & Projects** — multi-workspace per user, nested projects, project templates.
3. **Chat** — channels (project-scoped), DMs, threads, reactions, mentions, unread state, jump-to-date.
4. **Files** — upload / rename / move / copy / delete / version, preview, share links (public / workspace / restricted).
5. **Media tab** — extracted per chat: Images / Videos / Docs / Audio / Links with filters.
6. **Search** — global full-text across chats, files, comments, users, projects.
7. **Chunked upload** — up to 1 GB with resume, retry, checksum.
8. **RBAC** — owner/admin/member/guest + per-resource ACLs.
9. **Admin** — users, storage, audit logs, retention, rate limits, suspicious activity.
10. **Activity feed & notifications** — in-app, email digest, push (mobile).

---

## 5. Detailed User Stories

### 5.1 Onboarding
- **U1.** As a new user, I can sign up with email+password OR Google so I don't get stuck at auth.
- **U2.** As an invitee, clicking the email link drops me into the right workspace with role pre-assigned.
- **U3.** As an owner, first-run gives me a "name your workspace → invite 3 teammates → create first project" checklist.

### 5.2 Chat
- **U4.** As a member, I can open a channel with 8k messages and scroll smoothly; older messages lazy-load.
- **U5.** As a member, I can `/jump 2026-02-14` to scroll to that date without loading everything between.
- **U6.** As a member, the Media tab of a channel shows all images from the last year, filterable by sender.
- **U7.** As a member, pressing `↑` edits my last message; `Cmd+K` opens global search.

### 5.3 Files
- **U8.** As a member, I can drag a 900 MB MP4 into a chat; it uploads in background with a progress pill.
- **U9.** As a member, if my wifi drops mid-upload, I can resume from the last successful chunk.
- **U10.** As a member, I can share a file link "restricted to workspace" and see who viewed it.
- **U11.** As an admin, I can revoke any share link and the URL 404s immediately (no cache bleed).

### 5.4 Permissions & Admin
- **U12.** As an admin, I see an audit log of every permission change with actor, target, timestamp.
- **U13.** As an admin, I can set a retention policy ("delete chat messages > 365 days") per workspace.
- **U14.** As an owner, I can SSO-gate my workspace (v1.1).

---

## 6. Functional Requirements

| ID | Requirement |
|---|---|
| FR-1 | System must support email/password, Google OAuth, and invite-based signup. |
| FR-2 | Session tokens are short-lived JWTs (15 min) + rotating refresh tokens (30 d). |
| FR-3 | Chat must render a 5,000-message channel in <1 s cold load, <200 ms warm. |
| FR-4 | Media tab aggregates attachments per chat; updates within 2 s of upload. |
| FR-5 | Global search returns results in <500 ms p95 across all indexed content. |
| FR-6 | Chunked upload supports files up to 1 GB, chunk size 8 MB, resumable 24 h. |
| FR-7 | All file access is via signed R2 URLs with ≤15 min TTL. |
| FR-8 | Permission changes propagate to all sessions within 5 s. |
| FR-9 | Soft-deleted files are recoverable for 30 days; hard-deleted after. |
| FR-10 | Audit log is append-only, tamper-evident (hash-chained per workspace). |

---

## 7. Non-Functional Requirements

### 7.1 Scalability
- Horizontal stateless services behind an L7 LB.
- Chat service sharded by `workspace_id` → consistent hashing.
- Postgres with read replicas; hot tables partitioned by `workspace_id` + time.
- Target: **10 k concurrent WebSocket connections per node**, **100k msgs/sec cluster-wide**.

### 7.2 Performance
- p50 chat send → deliver: < 150 ms
- p95 search: < 500 ms
- p99 file download start: < 300 ms (signed R2 + CDN)
- Cold client load: < 1.2 s FCP on broadband

### 7.3 Real-time
- WebSocket (WSS) with heartbeat every 25 s, reconnect backoff w/ jitter.
- Server-side fan-out via Redis Pub/Sub; per-user delivery via connection registry.
- Offline → replay via `?since=<cursor>` REST endpoint on reconnect.

### 7.4 Fault tolerance
- Multi-AZ Postgres primary w/ synchronous replica.
- R2 automatic multi-region replication.
- Circuit breakers between services (resilience4j-style).
- Idempotency keys on all POST /files, /messages, /invites.

### 7.5 Security
- TLS 1.3 everywhere; HSTS; CSP strict-dynamic.
- At-rest: Postgres disk encryption, R2 SSE.
- Secrets via cloud KMS; short-lived DB creds (IAM auth).
- Rate limits: token-bucket per user + per IP; aggressive on `/auth/*`.
- OWASP Top 10 addressed; CSRF double-submit cookies; XSS via strict output escaping.

### 7.6 Observability
- Structured JSON logs (pino / zap); trace IDs propagated via `traceparent`.
- Metrics: RED (rate/errors/duration) per endpoint; USE on infra.
- Distributed tracing: OpenTelemetry → Tempo/Jaeger.
- Error tracking: Sentry.

### 7.7 Cost efficiency
- R2 chosen for **zero egress**.
- Previews generated once, cached in R2 `previews/` prefix.
- Cold chats (>90 d untouched) move to partitioned "cold" table + S3 Glacier-equivalent.

### 7.8 Backup / recovery
- Postgres: hourly snapshots, PITR 7 days, weekly cross-region.
- R2: versioning + 30-day object lock for compliance tier.
- DR drills quarterly; RTO 4h, RPO 15 min.

---

## 8. System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Client (Web / Mobile)                    │
│  React + Zustand (web)   ·   React Native (mobile)               │
└────────┬──────────────────────────────┬──────────────────────────┘
         │ HTTPS / WSS                  │
         ▼                              ▼
┌─────────────────┐          ┌─────────────────┐
│  Edge / CDN     │          │  WS Gateway     │
│  (Cloudflare)   │          │  (Node / uWS)   │
└────────┬────────┘          └────────┬────────┘
         ▼                            ▼
┌────────────────────────────────────────────────────┐
│                  API Gateway (Kong / Envoy)        │
└──┬──────┬──────┬──────┬──────┬──────┬──────┬──────┘
   │      │      │      │      │      │      │
   ▼      ▼      ▼      ▼      ▼      ▼      ▼
 Auth   Chat   File   Search  Perms  Notif  Admin
 svc    svc    svc    svc     svc    svc    svc
   │      │      │      │      │      │      │
   └──────┴──────┴──┬───┴──────┴──────┴──────┘
                   ▼
  ┌────────────────────────────────────────┐
  │  Postgres (primary + replicas)         │
  │  Redis (cache, pub/sub, presence)      │
  │  Elasticsearch / Meilisearch (search)  │
  │  Cloudflare R2 (blobs)                 │
  │  NATS / BullMQ (jobs)                  │
  └────────────────────────────────────────┘
```

### 8.1 Service responsibilities

| Service | Responsibility |
|---|---|
| **Auth** | Signup, login, OAuth, MFA, sessions, invites. |
| **Chat** | Messages, threads, reactions, WS fan-out, unread state. |
| **File** | Upload init/complete, signed URLs, versioning, preview jobs. |
| **Search** | Indexing pipeline, query API, relevance ranking. |
| **Permissions** | ACL evaluation, role management, caching. |
| **Notifications** | In-app, email digest, mobile push (APNS/FCM). |
| **Admin** | Audit log, retention jobs, abuse detection, dashboards. |
| **Media Processor** | Thumbnail gen, transcoding, media extraction from chat. |

### 8.2 Frontend modules
- `auth/` — sign-up, login, invite acceptance, MFA.
- `workspace/` — switcher, settings, billing.
- `project/` — sidebar, overview, task list.
- `chat/` — virtualized list, composer, thread panel, media tab.
- `files/` — grid/list, upload queue, preview modal, share dialog.
- `search/` — Cmd+K palette, results, filters, saved searches.
- `admin/` — users, audit, storage, retention, analytics.

---

## 9. Database Schema (Postgres)

```sql
users               (id uuid pk, email citext unique, name, avatar_url,
                     password_hash, mfa_secret, created_at, last_seen_at)

workspaces          (id uuid pk, slug citext unique, name, owner_id fk,
                     plan, created_at, deleted_at)

memberships         (id, workspace_id fk, user_id fk, role enum,
                     invited_by fk, status enum, unique(workspace_id,user_id))

projects            (id, workspace_id fk, name, slug, visibility, archived_at)

chats               (id, workspace_id fk, project_id fk null, type enum,
                     name, created_by fk, last_message_at)

messages            (id, chat_id fk, author_id fk, parent_id fk null,
                     body text, body_tsv tsvector, attachments jsonb,
                     reactions jsonb, created_at, edited_at, deleted_at)
                    PARTITION BY RANGE (created_at)
                    INDEX (chat_id, created_at DESC)
                    INDEX gin(body_tsv)

files               (id, workspace_id fk, uploader_id fk, name, size_bytes,
                     mime, checksum_sha256, r2_key, version int,
                     parent_folder_id fk null, created_at, deleted_at)

file_versions       (id, file_id fk, version, r2_key, size_bytes,
                     checksum, created_by, created_at)

attachments         (id, message_id fk, file_id fk, thumbnail_key)

acls                (id, resource_type enum, resource_id, principal_type,
                     principal_id, permission enum, inherited_from,
                     created_by, created_at)
                    UNIQUE (resource_type, resource_id, principal_type, principal_id, permission)

activity_log        (id bigserial, workspace_id, actor_id, verb, object_type,
                     object_id, metadata jsonb, created_at)
                    PARTITION BY RANGE (created_at)

share_links         (id, resource_type, resource_id, token citext unique,
                     visibility enum, expires_at, created_by, revoked_at)

upload_sessions     (id, user_id, workspace_id, filename, size, chunk_size,
                     total_chunks, received_bitmap bytea, checksum_expected,
                     status enum, r2_upload_id, created_at, expires_at)

notifications       (id, user_id, kind, payload jsonb, read_at, created_at)
```

### Indexing strategy
- `messages (chat_id, created_at DESC)` for pagination.
- `GIN (body_tsv)` for full-text; daily reindex of cold partitions.
- `files (workspace_id, deleted_at) WHERE deleted_at IS NULL`.
- `acls (resource_type, resource_id)` + `acls (principal_id)` for lookups.

---

## 10. API Endpoint Design

All endpoints: `/v1/*`, JSON, Bearer auth. Errors follow RFC 7807.

### Auth
```
POST   /v1/auth/signup                {email, password}
POST   /v1/auth/login                 {email, password}
POST   /v1/auth/oauth/google          {id_token}
POST   /v1/auth/refresh               {refresh_token}
POST   /v1/auth/mfa/enroll            → otpauth://
POST   /v1/auth/mfa/verify            {code}
POST   /v1/auth/password/reset        {email}
```

### Workspaces / Projects
```
GET    /v1/workspaces
POST   /v1/workspaces                 {name, slug}
GET    /v1/workspaces/:id
POST   /v1/workspaces/:id/invites     {emails[], role}
GET    /v1/workspaces/:id/members
PATCH  /v1/workspaces/:id/members/:uid {role}

GET    /v1/projects?workspace_id=
POST   /v1/projects                   {workspace_id, name}
```

### Chat
```
GET    /v1/chats?workspace_id=
POST   /v1/chats                      {workspace_id, type, name}
GET    /v1/chats/:id/messages?cursor=&limit=50&direction=before
POST   /v1/chats/:id/messages         {body, attachments[], parent_id?}
PATCH  /v1/messages/:id               {body}
DELETE /v1/messages/:id
POST   /v1/messages/:id/reactions     {emoji}
GET    /v1/chats/:id/media?type=&from=&to=&sender=
GET    /v1/chats/:id/jump?at=<iso>    → {cursor}

WSS    /v1/ws?token=                  subscribe:chat:<id>, presence:<workspace>
```

### Files
```
POST   /v1/uploads                    {filename, size, mime, checksum}
                                      → {upload_id, chunk_size, chunk_urls[]}
PUT    /v1/uploads/:id/chunks/:idx    (binary)
POST   /v1/uploads/:id/complete
GET    /v1/uploads/:id/status         → {received[], missing[]}

GET    /v1/files/:id
PATCH  /v1/files/:id                  {name, parent_folder_id}
DELETE /v1/files/:id
POST   /v1/files/:id/versions         (new upload)
POST   /v1/files/:id/share            {visibility, expires_at}
                                      → {url, token}
```

### Search
```
GET    /v1/search?q=&type=&workspace_id=&limit=&cursor=
POST   /v1/search/saved               {name, query}
```

### Admin
```
GET    /v1/admin/audit?from=&to=&actor=&verb=
GET    /v1/admin/storage
GET    /v1/admin/users
PATCH  /v1/admin/retention            {chat_days, file_days}
```

---

## 11. Cloudflare R2 Storage Design

### 11.1 Object key structure
```
workspaces/{workspace_id}/
  files/{file_id}/v{version}/{original_filename}
  previews/{file_id}/v{version}/{size}.webp
  thumbnails/{file_id}/v{version}/320.webp
  avatars/{user_id}.webp
  exports/{job_id}.zip
```

- Keys are immutable. Renames are DB-only; the R2 key tracks `file_id + version`.
- UUIDs (not slugs) in paths → no key collision on rename.

### 11.2 Metadata
Stored as R2 custom metadata + Postgres row of truth:
- `x-amz-meta-uploader`: user_id
- `x-amz-meta-workspace`: workspace_id
- `x-amz-meta-checksum`: sha256 hex
- `x-amz-meta-orig-name`: original filename (url-encoded)

### 11.3 Access model
- **Never expose R2 directly.** All access goes through signed URLs, issued by File svc after ACL check.
- Signed URL TTL: 15 min (download), 1 h (upload chunks).
- Downloads proxied via Cloudflare Workers for the public-share-link tier (enables revocation + rate limiting).

### 11.4 Lifecycle
- **Soft delete (30 d):** mark row, keep object.
- **Hard delete:** Worker job scans `deleted_at < now()-30d`, issues `DELETE` to R2.
- **Versions:** keep last 10 by default; configurable per workspace.
- **Cold tier:** objects untouched 180 d → move to `cold/` prefix (cheaper class).

### 11.5 CDN / cache
- Public share links: Cloudflare CDN (cache-key = token + range).
- Workspace downloads: 5-min edge cache; cache-busted on version bump.
- Previews: aggressive cache (1 y immutable, URL contains version).

---

## 12. Chunked Upload Workflow (1 GB Files)

```
 Client                                 File Svc           R2
   │                                      │                 │
   │ POST /uploads {name,size,sha256}     │                 │
   │─────────────────────────────────────▶│                 │
   │                                      │ CreateMultipart │
   │                                      │────────────────▶│
   │                                      │◀───upload_id────│
   │◀──── {upload_id, chunk_urls[128]} ───│                 │
   │                                      │                 │
   │ PUT chunk 0 (signed R2 URL)                            │
   │───────────────────────────────────────────────────────▶│
   │◀────── 200 ETag ────────────────────────────────────── │
   │       ... (parallel, 4 in flight) ...                  │
   │                                      │                 │
   │ POST /uploads/:id/complete           │                 │
   │ {parts: [{n,etag},...]}              │                 │
   │─────────────────────────────────────▶│                 │
   │                                      │ Complete MPU    │
   │                                      │────────────────▶│
   │                                      │ verify checksum │
   │                                      │ insert files row│
   │                                      │ enqueue preview │
   │◀──── {file_id, url} ─────────────────│                 │
```

### Resume
- Client calls `GET /uploads/:id/status` → server returns `received[]` bitmap.
- Client re-uploads only missing chunks.
- Sessions expire after 24 h; a cleanup job aborts stale R2 MPUs.

### Integrity
- Client computes SHA-256 of full file → sent on init.
- Each chunk carries its own CRC32C in the PUT header.
- On `complete`, server re-streams object, recomputes SHA-256, compares.
- Mismatch → mark session `corrupt`, delete object, return 422.

### Retries
- Idempotent: PUT on same chunk URL is safe.
- Client backs off 2^n ms + jitter on 5xx, max 5 attempts.

---

## 13. Search Architecture

### 13.1 Indexing pipeline
```
Message created → Outbox event → NATS → Index worker
                                            │
                                            ▼
                                      Meilisearch index
                                      (shard: workspace_id)
```

- **Two indices per workspace:** `messages`, `files`. Separate `users`, `projects` indices global.
- **Schema:** id, workspace_id, chat_id, author_id, body, created_at, has_attachments, mentions[].
- **Reindex:** async; lag SLO < 2 s p95.

### 13.2 Query
- Search svc parses query: `from:@alice has:file before:2026-03-01 "deploy script"`.
- Filters applied server-side; ACL post-filter against `acls` cache.
- Highlights returned per hit.
- Saved searches = JSONB doc per user.

### 13.3 Relevance
- BM25 default; boost recent (log-decay 30 d half-life).
- Boost exact-phrase matches 3×, mentions 2×.

---

## 14. Chat Architecture for 5,000+ Messages

### 14.1 Storage
- `messages` partitioned monthly by `created_at`.
- Hot partition fully in RAM (Postgres shared_buffers sized appropriately).
- Cold partitions accessed only on jump-to-date.

### 14.2 Pagination
- Cursor-based, not offset: `cursor = (created_at, id)`.
- Default page: 50 messages, direction=`before` (scroll up).
- Cursor is opaque base64(`{ts, id}`).

### 14.3 Virtualization (client)
- `react-virtuoso` or equivalent — windowed render, 10 items visible + 20 overscan.
- Sticky date separators rendered outside virtualization.
- Edit / delete diffs applied by ID lookup, no re-render of list.

### 14.4 Jump-to-date
- Client sends `GET /chats/:id/jump?at=2026-02-14T00:00`.
- Server returns a cursor; client clears list, refetches around that cursor.

### 14.5 Unread tracking
- `user_chat_state (user_id, chat_id, last_read_at, mention_count)`.
- Updated debounced (2 s) as user scrolls.
- Dot indicator = `chat.last_message_at > user_chat_state.last_read_at`.

### 14.6 Real-time
- Client subscribes to `ws://…/chats/:id` on entry.
- Server fan-out via Redis `PUBLISH chat:<id> {event}`.
- Delivery = Redis sub per WS node; per-user filter in memory.

---

## 15. Media Listing Architecture

### 15.1 Extraction
- On message insert, trigger analyzes `attachments[]` + scans `body` for URLs.
- Emits `media_indexed` event with `{chat_id, kind, file_id, url, created_at, sender_id}`.

### 15.2 Storage
- Denormalized `chat_media` table:
```
chat_media (id, chat_id fk, kind enum('image','video','doc','audio','link'),
            file_id fk null, url text null, sender_id fk, created_at,
            size_bytes, metadata jsonb)
           INDEX (chat_id, kind, created_at DESC)
```

### 15.3 Query
```
GET /v1/chats/:id/media?kind=image&sender=<uid>&from=&to=&cursor=
```
- Paginated; returns thumbnails + presigned preview URLs.
- Aggregations computed nightly and cached (counts by kind).

---

## 16. Security and Compliance

- **Authn:** JWT (RS256), 15 min access + 30 d refresh, rotate on use.
- **Authz:** Centralized ACL evaluator, cached per session (TTL 30 s, busted on change via pub/sub).
- **Audit log:** Append-only, hash-chained; admins can export signed bundle.
- **PII:** Minimal; emails hashed in logs via HMAC.
- **Data residency:** R2 region pinnable per workspace (enterprise tier).
- **GDPR:** DSAR endpoint exports user's data as ZIP; right-to-erasure cascades but preserves audit hashes.
- **SOC 2 readiness:** Terraform'd infra, change-management workflow, quarterly access reviews.

---

## 17. Admin Dashboard Requirements

- **Users tab:** role, last active, MFA status, suspend / delete.
- **Storage tab:** total used, breakdown by project, top files.
- **Audit tab:** filter by actor/verb/object/date; export CSV/JSON.
- **Retention tab:** policies per data type; dry-run before apply.
- **Security tab:** login anomalies, rate-limited IPs, revoked sessions.
- **Usage analytics:** DAU/WAU, messages/day, storage growth, feature adoption.

---

## 18. Edge Cases & Failure Scenarios

| Scenario | Behavior |
|---|---|
| Upload chunk corrupt | Server returns 422 w/ `chunk_idx`; client re-PUTs. |
| Chunk upload session expires | Return 410; client discards, restarts. |
| Checksum mismatch on complete | Delete object, session `corrupt`, 422 to client. |
| Revoked share link | Worker returns 404 from cache + origin. |
| Deleted file referenced in old message | Attachment renders as "file removed" tombstone. |
| Broken preview | Fallback to generic icon; retry job up to 3×. |
| Permission revoked mid-session | WS `permission_revoked` event; client evicts resource. |
| Race: two edits to same message | Last-writer-wins; version vector returned. |
| Partial WS drop | Client reconnects, replays via `since=<cursor>`. |
| 1 GB upload on flaky wifi | Resume from bitmap; no user action needed. |
| Workspace deleted with active sessions | Tokens revoked within 5 s via pub/sub. |
| User leaves workspace | Loses access to all resources not explicitly re-shared. |

---

## 19. MVP Scope vs Future

### MVP (v1)
- Auth (email + Google), invites, MFA.
- Workspaces, projects, flat chat.
- File upload (1 GB, chunked), share links, previews for image/video/PDF.
- Search: messages + files.
- Media tab (images, videos, docs, links).
- RBAC 4-role model + share ACLs.
- Admin: users, audit, storage, retention.
- Web app + responsive mobile web.

### v1.1
- Native mobile (iOS/Android).
- SSO (SAML / SCIM).
- Advanced search operators, saved searches.
- Voice notes.

### v2
- Tasks / project management (Asana-parity).
- Workflows / automations.
- External app integrations (Slack connect, GitHub).
- Data residency (EU region).

---

## 20. Engineering Risks & Recommendations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| R2 region outage | Low | High | Cross-region replication, failover keys. |
| Chat fan-out hotspot (viral channel) | Med | Med | Per-chat rate limit, batching, sharded pub/sub. |
| Search index lag at scale | Med | Med | Parallel workers; backpressure queue. |
| Storage cost creep | Med | Med | Retention defaults, cold tier, dashboards. |
| ACL cache staleness | Low | High | Pub/sub invalidation + short TTL. |
| Mobile chunked upload battery drain | Med | Low | Opportunistic wifi-only, resume on wake. |
| Abuse (large file spam) | Med | Med | Per-workspace quotas, upload rate limits, scanning. |

### Recommendations
1. **Build the permission model first.** Everything else depends on it.
2. **Ship chunked upload with resume on day one.** Retrofitting is painful.
3. **Invest in observability before scale.** Tracing > guessing.
4. **Use outbox pattern** for all cross-service events — exactly-once indexing.
5. **Partition `messages` and `activity_log` from v1**, even if partitions are small. Migrating later is 10× harder.
6. **Pick Meilisearch over Elasticsearch** for MVP — simpler ops, fast enough.
7. **Treat R2 keys as write-once.** Mutating the key surface will haunt you.

---

*End of document.*
