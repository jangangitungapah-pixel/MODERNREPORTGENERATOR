# ReportOS Production Runbook

This runbook activates the full-stack ReportOS control plane without enabling any paid service.

## Preconditions

- Cloudflare Workers Free account
- D1 available on the account
- Firebase project `reportgeneratornoc`
- Firebase Anonymous Authentication enabled
- Google provider enabled only if cross-device account linking is desired
- no Firebase Blaze upgrade
- no Firebase Storage
- no Cloudflare R2

## 1. Create D1

Create one production database named:

```text
reportos-db
```

Record the real Cloudflare D1 database UUID.

Never commit a placeholder UUID.

## 2. Bind D1

Add the real binding to `wrangler.jsonc`:

```json
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "reportos-db",
      "database_id": "<REAL-D1-UUID>",
      "migrations_dir": "drizzle"
    }
  ]
}
```

`DB` is the binding name consumed by server routes.

## 3. Apply migrations

Inspect first:

```text
npm run db:migrations:remote
```

Then apply:

```text
npm run db:migrate:remote
```

Current migration chain:

```text
0000_reportos_core.sql
0001_workspace_state.sql
0002_incident_soft_delete.sql
```

Do not manually create tables outside the migration chain.

## 4. Validate locally against Workers runtime

Use OpenNext preview rather than treating `next dev` as production-runtime validation:

```text
npm run preview:worker
```

Validate:

```text
GET /api/health
```

Expected after a valid D1 binding:

```json
{
  "ok": true,
  "ready": true,
  "service": "reportos",
  "database": {
    "binding": "ready",
    "canonicalModel": "ready"
  }
}
```

If `ok` is true but `ready` is false, the Worker is live while D1 is missing/unreachable. Do not delete browser or Firestore fallback data.

## 5. Deploy Worker

Run the repository deployment script only after CI is green and D1 health is ready:

```text
npm run deploy:worker
```

## 6. First-user migration verification

On first authenticated load with an empty D1 canonical workspace:

1. existing local workspace remains untouched
2. canonical sync uploads it as D1 revision 1
3. SHA-256 checksum is stored
4. normalized incident rows are projected
5. System Console shows revision 1
6. subsequent local save increments revision
7. previous revision becomes a recovery snapshot

Verify incident counts in System Console before trusting D1 as the primary recovery plane.

## 7. Cross-device verification

For true cross-device identity continuity, link the anonymous Firebase account to Google from `Secure workspace`.

Successful linking must preserve the same Firebase UID.

Verify:

1. device A shows linked non-anonymous identity
2. device B signs into the linked account
3. `/api/v1/session` resolves the same UID
4. same D1 workspace is returned
5. canonical revision matches
6. no anonymous workspace is deleted during linking

## 8. Recovery drill

Create a harmless draft revision, then another edit.

In `/system`:

1. confirm a recovery point exists
2. select Restore
3. confirm the current state is snapshotted before restore
4. return to Operations
5. confirm restored incident data matches the selected snapshot
6. confirm audit trail contains the restore-triggered workspace mutation

## 9. Conflict drill

Use two clients with the same linked identity.

1. allow both to start from the same revision
2. edit client A and let it save
3. edit stale client B
4. stale save must receive `REVISION_CONFLICT`
5. UI must show explicit conflict state
6. choose either `Use server` or `Keep local`
7. verify no silent overwrite occurs

## 10. Delete TT drill

Delete an incident through the normal ReportOS UI.

Verify:

- incident disappears from active workspace
- canonical prior revision exists in recovery history
- normalized incident is soft deleted
- `/api/v1/incidents` no longer returns it
- child normalized data remains available for future retention/audit policy

## Rollback

If Worker/D1 behavior is unhealthy:

1. do not clear localStorage
2. do not delete Firestore recovery documents
3. stop relying on canonical D1 sync
4. use existing local/Firestore recovery plane
5. roll Worker code back to the last known-green Git commit
6. inspect `/api/health`
7. repair D1 migration/binding before re-enabling canonical use

The application intentionally treats D1 unavailability as `SERVER STANDBY`; browser and Firestore safety data are not destroyed by that condition.

## Database Recovery

The canonical workspace payload is the source for rebuilding normalized read-model tables.

If normalized projection is suspected stale but canonical checksum/revision is valid, re-saving the same canonical workspace causes projection to be rebuilt without creating a new revision.

## Retention

Do not physically purge soft-deleted incident rows until a retention policy is explicitly approved.

The soft-delete trigger intercepts the first delete. A future retention job may physically remove rows that already have `deleted_at` set after an approved retention period.

## Free-Tier Safety

If a free-tier quota is exhausted:

- degrade to local safety cache where applicable
- preserve existing data
- surface readiness/availability status
- never automatically enable or upgrade to a paid plan
- never add a billing method as an automated remediation
