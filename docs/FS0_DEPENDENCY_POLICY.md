# FS-0 Dependency Policy

ReportOS adopts dependencies only when the current phase actually uses them.

## Installed in FS-0

Runtime:

- zod 4.4.3
- drizzle-orm 0.45.2

Build and migration:

- @opennextjs/cloudflare 1.20.2
- wrangler 4.118.0
- drizzle-kit 0.31.10
- @vitest/coverage-v8 4.1.10

## Deferred

The following packages are intentionally deferred until their owning phase:

- @hookform/resolvers
- react-hook-form
- TanStack Query
- TanStack Table
- TanStack Virtual
- Dexie
- JOSE
- NanoID
- date-fns
- Radix UI primitives
- cmdk
- sonner
- Playwright
- axe
- MSW
- Knip

This is deliberate.

Installing future-phase dependencies before they are used increases peer-dependency conflicts,
supply-chain surface, lockfile churn, and upgrade cost.

## Resolver decision

FS-0 does not install @hookform/resolvers.

Current resolver releases can pull optional TypeSchema adapters whose Zod peer range can conflict
with a Zod 4 dependency tree. ReportOS will add a form resolver only in the phase where forms are
migrated, after testing the exact resolver/Zod combination.

Do not use:

- npm install --force
- npm install --legacy-peer-deps

A clean dependency graph is a quality requirement.
