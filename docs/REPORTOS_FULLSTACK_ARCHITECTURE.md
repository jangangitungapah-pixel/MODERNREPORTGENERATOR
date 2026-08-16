# ReportOS Full-Stack Architecture

ReportOS is a Next.js full-stack incident operations platform running on Cloudflare Workers Free with Firebase Authentication on Spark, Cloudflare D1 as the canonical server database, Firestore as a recovery safety plane, and localStorage as an offline/browser safety cache.

Production URL:

```text
https://reportos.reportosnoc.workers.dev
```

Firebase Hosting is retired and is not part of the production delivery path.

## Architecture

```text
Browser / ReportOS
        |
        | Firebase ID token
        v
Next.js Route Handlers on Cloudflare Workers
        |
        +-- authenticated session boundary
        +-- workspace authorization / RBAC
        +-- optimistic revision checks
        +-- request correlation
        +-- recovery snapshots
        +-- audit trail
        |
        v
Cloudflare D1
        |
        +-- workspace_states      canonical revision envelope
        +-- incidents             normalized read model
        +-- progress_entries
        +-- impact_links
        +-- cut_points
        +-- closure_states
        +-- recovery_snapshots
        +-- audit_events
        +-- users / workspaces / membership

Browser safety plane
        |
        +-- localStorage workspace cache
        +-- conflict-safe reconciliation
        +-- BroadcastChannel multi-tab propagation
        +-- offline fallback
        +-- Firebase Firestore recovery
```

## Runtime

- Next.js 16 App Router
- Cloudflare Workers through `@opennextjs/cloudflare`
- dynamic Route Handlers
- React Server Components remain available to normal Next.js pages
- browser-only Firebase services are isolated from Worker SSR and mounted client-side
- OpenNext Worker build is validated in Linux CI
- production and development Next.js generated types are isolated

The app does not use `output: 'export'` and does not use Firebase Hosting.

## Identity

Firebase Authentication Spark remains the identity provider.

Browser requests obtain a Firebase ID token. Server routes resolve the token against Firebase Authentication before accepting the Firebase UID as an authenticated principal.

A UID supplied through request JSON, query parameters, browser storage or arbitrary headers is never accepted as identity.

Anonymous Firebase users remain the frictionless default. The UI can link the current anonymous user to Google with `linkWithPopup`; successful linking preserves the existing Firebase UID so D1 workspace ownership does not change. A linked Google identity can also be selected with `signInWithPopup` on another browser/device and then resolve the same UID/workspace.

Google linking/sign-in is an optional interactive identity capability; the core ReportOS production path remains fully usable with anonymous Firebase Authentication.

## Authorization

Workspace roles:

```text
operator < supervisor < admin
```

Personal workspace owners bootstrap as `admin`.

Examples:

- normal canonical workspace save: authenticated workspace member
- recovery history: authenticated member
- recovery restore: supervisor or admin
- audit trail: supervisor or admin

D1 is never exposed directly to the browser.

## Canonical State

`workspace_states` is the authoritative operational revision envelope.

Every canonical workspace save contains:

- validated workspace JSON
- active incident ID
- monotonically increasing revision
- SHA-256 checksum
- last writer UID
- updated timestamp

The client sends `expectedRevision`. A stale writer receives `409 REVISION_CONFLICT` instead of silently overwriting a newer revision.

Before replacing an existing canonical revision, ReportOS writes the previous payload into `recovery_snapshots`.

## Normalized Read Model

Every successful canonical save also projects the workspace into relational D1 tables:

- `incidents`
- `progress_entries`
- `impact_links`
- `cut_points`
- `closure_states`

Child identity is scoped by `(incident_id, id)`, so generated IDs such as `p01` can safely appear in multiple incidents.

Removed incidents are soft-deleted explicitly by the server projection service. The incident row is marked `lifecycle = 'archived'` and receives `deleted_at`; normal incident APIs filter `deleted_at IS NULL`. ReportOS does not depend on a multi-statement SQLite trigger for this behavior.

The canonical revision envelope remains the recovery source of truth if normalized projection ever needs to be rebuilt.

## Client Synchronization

The global canonical sync controller:

1. authenticates the current Firebase user
2. loads D1 canonical state
3. performs one-time local-to-D1 migration when D1 is empty
4. keeps localStorage as an offline safety cache
5. compares SHA-256 checksums
6. performs optimistic revision saves
7. detects local/server divergence
8. exposes explicit `Use server` / `Keep local` conflict resolution
9. polls server revisions for cross-device freshness
10. broadcasts revision changes across tabs with `BroadcastChannel`

If the D1 binding is unavailable, the controller switches to `SERVER STANDBY`; it never clears local state. Firestore recovery remains available as an additional safety plane.

## Firestore Recovery Safety Plane

Firestore is not canonical storage. It remains a browser recovery layer scoped by Firebase UID.

Security rules enforce:

- users can only read/write documents below their own UID
- recovery snapshots are immutable after creation
- snapshots can be explicitly deleted by their owner
- unmatched Firestore paths are denied

Production acceptance validates owner access, cross-UID denial, snapshot immutability, and cleanup against the live Firebase project.

## Server APIs

### Public liveness/readiness

```text
GET /api/health
```

The response separates application liveness (`ok`) from canonical database readiness (`ready`).

### Authenticated

```text
GET /api/v1/session
GET /api/v1/workspace
PUT /api/v1/workspace
GET /api/v1/incidents
GET /api/v1/incidents/:incidentId
GET /api/v1/recovery
POST /api/v1/recovery
GET /api/v1/audit
```

Every authenticated route is workspace scoped.

## System Console

`/system` is the ReportOS control plane for:

- current identity
- workspace role
- canonical revision
- incident count
- canonical checksum
- last writer
- D1 recovery history
- recovery restore
- audit trail

## Operational Intelligence

ReportOS includes a deterministic intelligence layer that requires no paid AI API.

Current checks include:

- missing TT/PIC/root cause/cut point
- dispatch before occur time
- progress before occur time
- link restored in timeline while marker remains Down/Warning
- closed status while marker remains degraded
- restored service with incomplete closure checklist
- actionable `What's Pending` list
- RFO draft generation
- shift handover generation

## Resilience

- local workspace is never cleared by a server connectivity failure
- revision conflicts require explicit resolution
- canonical overwrite produces a recovery snapshot
- System Console provides restore controls
- Firestore cloud recovery remains available as a second safety layer
- global application error boundary does not clear local drafts
- deleted normalized incidents are soft deleted by the application service

## Security Controls

- Firebase token resolved server-side
- no trusted client UID parameter
- workspace membership authorization
- RBAC for privileged recovery/audit operations
- request IDs on server error/success boundaries
- no-store API responses
- X-Content-Type-Options
- X-Frame-Options
- Referrer-Policy
- restrictive camera/microphone/geolocation Permissions-Policy
- COOP configured to preserve Firebase Google popup compatibility
- HSTS in production

A strict CSP is deliberately not shipped until Firebase/Google endpoints are enumerated and tested; an untested CSP is more likely to break authentication than improve production safety.

## Zero-Paid-Service Rule

Forbidden by architecture policy:

- Firebase Blaze
- Cloud Functions
- Firebase App Hosting
- Firebase Storage
- Cloudflare R2
- paid external observability
- commercial runtime package licenses

SOR/PDF processing remains browser-local and does not require object storage.

## CI Quality Boundary

Every revision on `main` is validated with:

- clean `npm ci`
- production dependency audit at high severity
- TypeScript route-aware typecheck
- ESLint
- Vitest
- Next.js production build
- OpenNext Cloudflare Worker build

Workflow concurrency cancels superseded `main` runs so only the latest revision consumes CI time.

## Production Acceptance Boundary

The reusable command is:

```text
npm run acceptance:production
```

The live acceptance harness validates:

- Worker health and D1 readiness
- production homepage HTTP 200
- Firebase anonymous authentication
- authenticated workspace bootstrap
- first canonical D1 revision
- normalized incident/timeline/impact/cut-point/closure projection
- canonical revision increments
- stale-write `REVISION_CONFLICT`
- recovery snapshot creation and restore
- audit trail
- soft-delete visibility rules
- Firestore owner read/write
- Firestore cross-UID denial
- immutable Firestore recovery snapshots

The harness uses isolated synthetic identities and ends its D1 test workspace with no active incident. Firestore test documents are deleted after validation.

## Production Activation State

Production infrastructure is active:

- Worker name: `reportos`
- Workers.dev account subdomain: `reportosnoc.workers.dev`
- production URL: `https://reportos.reportosnoc.workers.dev`
- D1 database: `reportos-db`
- Worker binding: `DB`
- D1 migration chain `0000`, `0001`, and `0002` applied
- `/api/health` reports `ready: true`
- Firebase Hosting configuration removed

At this point infrastructure, persistence, recovery, authorization, build, and runtime foundations are production concerns rather than pending implementation work. Future work can focus on product features, UI, UX, performance tuning, and optional integrations without changing the canonical architecture.
