# ReportOS Production Runbook

This runbook operates the live full-stack ReportOS control plane without enabling any paid service.

Production URL:

```text
https://reportos.reportosnoc.workers.dev
```

## Production invariants

- Cloudflare Workers Free is the application runtime and hosting layer
- Cloudflare D1 `reportos-db` is canonical server storage
- Worker D1 binding name is `DB`
- Firebase Authentication Spark is the identity provider
- Firebase Firestore is a recovery safety layer, not canonical storage
- localStorage remains an offline/browser safety cache
- Firebase Hosting is retired
- no Firebase Blaze upgrade
- no Firebase Storage
- no Cloudflare R2
- no paid external runtime service is required

## 1. D1 configuration

The production database is:

```text
reportos-db
```

The committed Worker configuration contains the real D1 UUID and:

```json
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "reportos-db",
      "database_id": "2914d882-d24f-41f8-a1a1-3ebebb558d30",
      "migrations_dir": "drizzle"
    }
  ]
}
```

`DB` is the binding consumed by server routes.

Never replace the UUID with a placeholder in production configuration.

## 2. Migrations

Inspect first:

```text
npm run db:migrations:remote
```

Apply pending migrations only after inspection:

```text
npm run db:migrate:remote
```

Current production migration chain:

```text
0000_reportos_core.sql
0001_workspace_state.sql
0002_incident_soft_delete.sql
```

All three migrations are applied in production.

Do not manually create or mutate schema objects outside the migration chain.

## 3. Quality gate

Before deployment, `main` must pass ReportOS Quality:

```text
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run build:worker
npm audit --omit=dev --audit-level=high
```

Do not suppress the security audit and do not use `npm audit fix --force` as a release shortcut.

## 4. Deploy Worker

Deploy only a green revision:

```text
npm run deploy:worker
```

The expected public route is:

```text
https://reportos.reportosnoc.workers.dev
```

After deployment, verify readiness:

```text
GET /api/health
```

Expected shape:

```json
{
  "ok": true,
  "ready": true,
  "service": "reportos",
  "runtime": "cloudflare-workers",
  "architecture": "full-stack",
  "database": {
    "binding": "ready",
    "canonicalModel": "ready"
  }
}
```

If `ok` is true but `ready` is false, the Worker is live while D1 is missing or unreachable. Do not clear browser or Firestore safety data.

## 5. Production acceptance

Run intentional release acceptance with:

```text
npm run acceptance:production
```

The harness validates the live production stack rather than a local mock. It covers:

1. Worker health and D1 readiness
2. production homepage HTTP 200
3. Firebase anonymous identity creation
4. authenticated session/workspace bootstrap
5. canonical D1 revision 1
6. normalized incident projection
7. timeline, impact, cut-point, and closure child projection
8. revision increment
9. stale-write `409 REVISION_CONFLICT`
10. recovery snapshot creation
11. recovery restore into a new revision
12. production audit trail
13. application-level soft delete
14. deleted incident exclusion from normal read APIs
15. recoverability of the pre-delete canonical state
16. Firestore owner read/write
17. Firestore cross-UID denial
18. immutable Firestore recovery snapshots
19. Firestore acceptance-document cleanup

The D1 acceptance workspace ends with no active synthetic incident. Firestore acceptance documents are deleted by the harness.

This command intentionally creates an isolated anonymous D1 acceptance identity/workspace. Run it for release acceptance, not as a frequent polling job.

## 6. First-user migration behavior

On first authenticated load with an empty D1 canonical workspace:

1. existing local workspace remains untouched
2. canonical sync uploads it as D1 revision 1
3. SHA-256 checksum is stored
4. normalized incident rows are projected
5. System Console shows revision 1
6. subsequent local save increments revision
7. previous revision becomes a recovery snapshot

The production acceptance harness independently validates the same canonical write/revision/projection path with an isolated synthetic identity.

## 7. Identity and cross-device continuity

Anonymous Firebase Authentication is the default identity path.

`Secure workspace` supports:

- linking the current anonymous identity to Google while preserving the UID
- signing into an already-linked Google identity from another browser/device

Google linking is optional and interactive. If it is enabled for the deployment, verify with a real Google account when that capability is intentionally used:

1. device A links the anonymous identity
2. Firebase UID remains unchanged
3. device B signs into that linked account
4. `/api/v1/session` resolves the same UID
5. the same D1 workspace/revision is returned
6. no anonymous workspace is deleted during linking

Failure or cancellation of the Google popup must not delete local, D1, or Firestore data.

## 8. Recovery drill

Production acceptance already validates server recovery automatically. For an operator-facing manual drill:

1. create a harmless draft revision
2. create another edit
3. open `/system`
4. confirm a recovery point exists
5. select Restore
6. return to Operations
7. confirm restored incident data matches the selected snapshot
8. confirm the audit trail contains the resulting workspace mutation

## 9. Conflict behavior

Canonical saves use optimistic revisions.

A stale client must receive:

```text
409 REVISION_CONFLICT
```

The UI then exposes explicit conflict resolution rather than silently overwriting a newer revision.

The production acceptance harness validates the server-side stale-write rejection on every intentional acceptance run.

## 10. Delete behavior

Deleting a TT through the normal ReportOS workspace removes it from canonical active state.

The server projection service then performs an explicit D1 update:

- `lifecycle` becomes `archived`
- `deleted_at` is populated
- normalized revision increases
- normal incident APIs exclude the tombstoned row
- prior canonical state remains available in recovery history

ReportOS does **not** rely on a multi-statement SQLite soft-delete trigger. That trigger design was removed because D1/Wrangler migration parsing made it unnecessarily fragile.

Do not physically purge tombstoned incidents until an explicit retention policy is approved.

## 11. Firestore recovery safety plane

Firestore is UID-scoped recovery storage.

Security expectations:

- authenticated users can only access documents below their own UID
- unmatched paths are denied
- recovery snapshots are immutable after creation
- owners may explicitly delete their own snapshots

These rules are validated against the live Firebase project by `npm run acceptance:production`.

Firestore is not the canonical persistence layer and must not be promoted to canonical ownership without an architecture change.

## 12. Rollback

If a Worker revision behaves incorrectly:

1. do not clear localStorage
2. do not delete Firestore recovery documents
3. identify the last known-green Git revision
4. roll the Worker back or redeploy that known-green revision
5. inspect `/api/health`
6. inspect D1 migration state before making schema changes
7. re-run production acceptance after remediation

D1 unavailability is surfaced as server standby/readiness failure; safety-plane data must not be destroyed as remediation.

## 13. Database recovery

The canonical workspace payload is the source for rebuilding normalized read-model tables.

If normalized projection is suspected stale while canonical checksum/revision is valid, saving the same canonical workspace causes projection to be rebuilt without creating a new canonical revision.

## 14. Retention

Soft deletion is implemented by the application projection service, not a database trigger.

Do not physically purge tombstoned incident rows, recovery snapshots, or audit history until a retention policy is explicitly approved.

A future retention job may physically remove eligible records after that policy exists and is tested against recovery requirements.

## 15. Free-tier safety

If a free-tier quota is exhausted:

- degrade to local safety cache where applicable
- preserve existing data
- surface readiness/availability status
- never automatically enable or upgrade to a paid plan
- never add a billing method as automated remediation

## Production completion definition

The foundation is considered production-complete when all of the following are true:

- latest `main` quality workflow is green
- D1 reports no pending migration
- `/api/health` reports `ready: true`
- production homepage returns HTTP 200
- `npm run acceptance:production` passes against the live deployment
- repository documentation matches the deployed architecture

Once those conditions hold, remaining work is normal product evolution: new features, UI/UX changes, optional integrations, and performance improvements rather than unfinished production infrastructure.
