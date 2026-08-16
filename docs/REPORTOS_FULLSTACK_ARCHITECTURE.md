# ReportOS Full-Stack Architecture

ReportOS is migrating incrementally from a static/client-first application into a professional full-stack operational platform.

## Runtime

- Next.js 16
- Cloudflare Workers Free
- OpenNext Cloudflare adapter

## Identity

- Firebase Authentication Spark
- Server-side Firebase ID token verification is introduced in FS-1.

## Canonical Database Target

- Cloudflare D1 Free
- Drizzle ORM
- normalized operational tables
- revisions, recovery and audit

## Transitional Data

Existing Firestore cloud recovery remains intact during migration.

Firestore must not be removed until:
1. D1 migration has imported existing data.
2. record counts/checksums are verified.
3. cross-device restore is verified.
4. rollback has been tested.

## Zero-Paid-Service Rule

Forbidden:
- Firebase Blaze
- Cloud Functions
- Firebase App Hosting
- Firebase Storage
- Cloudflare R2
- paid external observability
- commercial package licenses

## Phase Boundary

FS-0 only creates the full-stack runtime and data foundation.
It intentionally does not switch existing Composer/Vault persistence to D1 yet.
