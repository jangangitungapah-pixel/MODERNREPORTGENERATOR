const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = process.cwd();
const stamp = Date.now();
const backups = new Set();

function file(relativePath) {
  return path.join(root, relativePath);
}

function normalize(value) {
  return value.replace(/\r\n/g, '\n');
}

function read(relativePath) {
  const target = file(relativePath);

  if (!fs.existsSync(target)) {
    throw new Error(
      `Required file not found: ${relativePath}`
    );
  }

  return normalize(
    fs.readFileSync(target, 'utf8')
  );
}

function ensureDir(relativePath) {
  fs.mkdirSync(
    file(relativePath),
    { recursive: true }
  );
}

function backup(relativePath, original) {
  if (backups.has(relativePath)) {
    return;
  }

  fs.writeFileSync(
    `${file(relativePath)}.bak-${stamp}`,
    original,
    'utf8'
  );

  backups.add(relativePath);
}

function write(relativePath, content) {
  const target = file(relativePath);
  ensureDir(path.dirname(relativePath));

  const original =
    fs.existsSync(target)
      ? fs.readFileSync(target, 'utf8')
      : null;

  const next = normalize(content);

  if (
    original !== null &&
    normalize(original) === next
  ) {
    console.log(`verified ${relativePath}`);
    return;
  }

  if (original !== null) {
    backup(relativePath, original);
  }

  fs.writeFileSync(
    target,
    next,
    'utf8'
  );

  console.log(
    `${original === null ? 'created' : 'updated'} ${relativePath}`
  );
}

function assertCleanTrackedTree() {
  try {
    cp.execFileSync(
      'git',
      ['diff', '--quiet'],
      { cwd: root, stdio: 'ignore' }
    );

    cp.execFileSync(
      'git',
      ['diff', '--cached', '--quiet'],
      { cwd: root, stdio: 'ignore' }
    );
  } catch {
    throw new Error(
      'Tracked working tree is not clean. Finish/commit the current ReportOS change before starting FS-0.'
    );
  }

  const gitDir = file('.git');

  for (const marker of [
    'MERGE_HEAD',
    'REBASE_HEAD',
    'CHERRY_PICK_HEAD',
  ]) {
    if (
      fs.existsSync(
        path.join(gitDir, marker)
      )
    ) {
      throw new Error(
        `Git operation still active: ${marker}`
      );
    }
  }
}

// -----------------------------------------------------------------------------
// PRE-FLIGHT
// -----------------------------------------------------------------------------

assertCleanTrackedTree();

const currentPackage =
  JSON.parse(
    read('package.json')
  );

if (
  currentPackage.name !==
  'modern-report-generator'
) {
  throw new Error(
    'Unexpected package.json. Refusing to patch the wrong project.'
  );
}

// -----------------------------------------------------------------------------
// PACKAGE SCRIPTS
// -----------------------------------------------------------------------------

{
  const relativePath = 'package.json';
  const original = read(relativePath);
  const pkg = JSON.parse(original);

  pkg.scripts = {
    ...pkg.scripts,
    quality:
      'npm run typecheck && npm run lint && npm test && npm run build',
    'test:coverage':
      'vitest run --coverage',
    'build:worker':
      'opennextjs-cloudflare build',
    'preview:worker':
      'opennextjs-cloudflare build && opennextjs-cloudflare preview',
    'upload:worker':
      'opennextjs-cloudflare build && opennextjs-cloudflare upload',
    'deploy:worker':
      'opennextjs-cloudflare build && opennextjs-cloudflare deploy',
    'cf:typegen':
      'wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts',
    'db:generate':
      'drizzle-kit generate',
    'firebase:deploy':
      'firebase deploy --only auth,firestore --project reportgeneratornoc',
    'firebase:deploy:data':
      'firebase deploy --only auth,firestore --project reportgeneratornoc',
  };

  write(
    relativePath,
    JSON.stringify(
      pkg,
      null,
      2
    ) + '\n'
  );
}

// -----------------------------------------------------------------------------
// NEXT FULL-STACK RUNTIME
// -----------------------------------------------------------------------------

write(
  'next.config.mjs',
  `import {
  initOpenNextCloudflareForDev,
} from '@opennextjs/cloudflare';

initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Keep Turbopack scoped to this repo even when
  // another package-lock exists higher in C:\\Users.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
`
);

write(
  'open-next.config.ts',
  `import {
  defineCloudflareConfig,
} from '@opennextjs/cloudflare';

export default defineCloudflareConfig();
`
);

write(
  'wrangler.jsonc',
  `{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "reportos",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-08-16",
  "compatibility_flags": [
    "nodejs_compat"
  ],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  },
  "vars": {
    "REPORTOS_ENV": "production"
  }
}
`
);

write(
  'public/_headers',
  `/_next/static/*
  Cache-Control: public,max-age=31536000,immutable
`
);

// -----------------------------------------------------------------------------
// GITIGNORE
// -----------------------------------------------------------------------------

{
  const relativePath = '.gitignore';
  const original = read(relativePath);

  const required = [
    '.open-next',
    '.wrangler',
    '.dev.vars',
  ];

  const lines =
    original
      .trimEnd()
      .split('\n');

  for (const entry of required) {
    if (!lines.includes(entry)) {
      lines.push(entry);
    }
  }

  write(
    relativePath,
    lines.join('\n') + '\n'
  );
}

// -----------------------------------------------------------------------------
// SHARED API CONTRACT
// -----------------------------------------------------------------------------

write(
  'lib/contracts/system.ts',
  `import {
  z,
} from 'zod';

export const systemHealthSchema =
  z.object({
    ok: z.literal(true),
    service:
      z.literal('reportos'),
    runtime:
      z.literal(
        'cloudflare-workers'
      ),
    architecture:
      z.literal(
        'full-stack'
      ),
    databasePhase:
      z.literal(
        'foundation'
      ),
    timestamp:
      z.string().datetime(),
    requestId:
      z.string().min(1),
  });

export type SystemHealth =
  z.infer<
    typeof systemHealthSchema
  >;
`
);

write(
  'lib/contracts/system.test.ts',
  `import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  systemHealthSchema,
} from './system';

describe(
  'system health contract',
  () => {
    it(
      'accepts the ReportOS full-stack health envelope',
      () => {
        expect(
          systemHealthSchema.parse({
            ok: true,
            service:
              'reportos',
            runtime:
              'cloudflare-workers',
            architecture:
              'full-stack',
            databasePhase:
              'foundation',
            timestamp:
              '2026-08-16T10:00:00.000Z',
            requestId:
              'health-test',
          })
        ).toEqual({
          ok: true,
          service:
            'reportos',
          runtime:
            'cloudflare-workers',
          architecture:
            'full-stack',
          databasePhase:
            'foundation',
          timestamp:
            '2026-08-16T10:00:00.000Z',
          requestId:
            'health-test',
        });
      }
    );
  }
);
`
);

// -----------------------------------------------------------------------------
// SERVER API HEALTH ENDPOINT
// -----------------------------------------------------------------------------

write(
  'app/api/health/route.ts',
  `import {
  NextResponse,
} from 'next/server';

import {
  systemHealthSchema,
} from '@/lib/contracts/system';

export const dynamic =
  'force-dynamic';

export async function GET() {
  const payload =
    systemHealthSchema.parse({
      ok: true,
      service: 'reportos',
      runtime:
        'cloudflare-workers',
      architecture:
        'full-stack',
      databasePhase:
        'foundation',
      timestamp:
        new Date().toISOString(),
      requestId:
        crypto.randomUUID(),
    });

  return NextResponse.json(
    payload,
    {
      headers: {
        'Cache-Control':
          'no-store',
      },
    }
  );
}
`
);

// -----------------------------------------------------------------------------
// D1 / DRIZZLE SCHEMA FOUNDATION
// -----------------------------------------------------------------------------

write(
  'lib/server/db/schema.ts',
  `import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const appUsers =
  sqliteTable(
    'app_users',
    {
      uid:
        text('uid')
          .primaryKey(),
      email:
        text('email'),
      displayName:
        text(
          'display_name'
        ),
      role:
        text(
          'role',
          {
            enum: [
              'operator',
              'supervisor',
              'admin',
            ],
          }
        )
          .notNull()
          .default(
            'operator'
          ),
      createdAt:
        integer(
          'created_at'
        ).notNull(),
      updatedAt:
        integer(
          'updated_at'
        ).notNull(),
    }
  );

export const workspaces =
  sqliteTable(
    'workspaces',
    {
      id:
        text('id')
          .primaryKey(),
      ownerUid:
        text(
          'owner_uid'
        )
          .notNull()
          .references(
            () =>
              appUsers.uid,
            {
              onDelete:
                'cascade',
            }
          ),
      name:
        text('name')
          .notNull(),
      createdAt:
        integer(
          'created_at'
        ).notNull(),
      updatedAt:
        integer(
          'updated_at'
        ).notNull(),
    },
    (table) => [
      index(
        'idx_workspaces_owner'
      ).on(
        table.ownerUid
      ),
    ]
  );

export const workspaceMembers =
  sqliteTable(
    'workspace_members',
    {
      workspaceId:
        text(
          'workspace_id'
        )
          .notNull()
          .references(
            () =>
              workspaces.id,
            {
              onDelete:
                'cascade',
            }
          ),
      uid:
        text('uid')
          .notNull()
          .references(
            () =>
              appUsers.uid,
            {
              onDelete:
                'cascade',
            }
          ),
      role:
        text(
          'role',
          {
            enum: [
              'operator',
              'supervisor',
              'admin',
            ],
          }
        )
          .notNull()
          .default(
            'operator'
          ),
      createdAt:
        integer(
          'created_at'
        ).notNull(),
    },
    (table) => [
      uniqueIndex(
        'uq_workspace_member'
      ).on(
        table.workspaceId,
        table.uid
      ),
      index(
        'idx_workspace_member_uid'
      ).on(
        table.uid
      ),
    ]
  );

export const incidents =
  sqliteTable(
    'incidents',
    {
      id:
        text('id')
          .primaryKey(),
      workspaceId:
        text(
          'workspace_id'
        )
          .notNull()
          .references(
            () =>
              workspaces.id,
            {
              onDelete:
                'cascade',
            }
          ),
      lifecycle:
        text(
          'lifecycle',
          {
            enum: [
              'active',
              'archived',
            ],
          }
        )
          .notNull()
          .default(
            'active'
          ),
      region:
        text('region')
          .notNull()
          .default(''),
      summary:
        text('summary')
          .notNull()
          .default(''),
      ticket:
        text('ticket')
          .notNull()
          .default(''),
      occurTime:
        text(
          'occur_time'
        )
          .notNull()
          .default(''),
      dispatchTime:
        text(
          'dispatch_time'
        )
          .notNull()
          .default(''),
      pic:
        text('pic')
          .notNull()
          .default(''),
      rootcause:
        text(
          'rootcause'
        )
          .notNull()
          .default(''),
      cutPoint:
        text(
          'cut_point'
        )
          .notNull()
          .default(''),
      primaryMarker:
        text(
          'primary_marker'
        ),
      statusTag:
        text(
          'status_tag'
        ),
      revision:
        integer(
          'revision'
        )
          .notNull()
          .default(1),
      createdBy:
        text(
          'created_by'
        )
          .notNull()
          .references(
            () =>
              appUsers.uid
          ),
      updatedBy:
        text(
          'updated_by'
        )
          .notNull()
          .references(
            () =>
              appUsers.uid
          ),
      createdAt:
        integer(
          'created_at'
        ).notNull(),
      updatedAt:
        integer(
          'updated_at'
        ).notNull(),
      deletedAt:
        integer(
          'deleted_at'
        ),
    },
    (table) => [
      index(
        'idx_incidents_workspace_updated'
      ).on(
        table.workspaceId,
        table.updatedAt
      ),
      index(
        'idx_incidents_ticket'
      ).on(
        table.ticket
      ),
      index(
        'idx_incidents_lifecycle'
      ).on(
        table.workspaceId,
        table.lifecycle
      ),
    ]
  );

export const progressEntries =
  sqliteTable(
    'progress_entries',
    {
      id:
        text('id')
          .primaryKey(),
      incidentId:
        text(
          'incident_id'
        )
          .notNull()
          .references(
            () =>
              incidents.id,
            {
              onDelete:
                'cascade',
            }
          ),
      date:
        text('date'),
      time:
        text('time')
          .notNull(),
      text:
        text('text')
          .notNull(),
      kind:
        text('kind'),
      position:
        integer(
          'position'
        )
          .notNull()
          .default(0),
      createdBy:
        text(
          'created_by'
        )
          .notNull()
          .references(
            () =>
              appUsers.uid
          ),
      createdAt:
        integer(
          'created_at'
        ).notNull(),
      updatedAt:
        integer(
          'updated_at'
        ).notNull(),
    },
    (table) => [
      index(
        'idx_progress_incident_position'
      ).on(
        table.incidentId,
        table.position
      ),
    ]
  );

export const impactLinks =
  sqliteTable(
    'impact_links',
    {
      id:
        text('id')
          .primaryKey(),
      incidentId:
        text(
          'incident_id'
        )
          .notNull()
          .references(
            () =>
              incidents.id,
            {
              onDelete:
                'cascade',
            }
          ),
      marker:
        text('marker')
          .notNull()
          .default(
            'unknown'
          ),
      region:
        text('region')
          .notNull()
          .default(''),
      statusTag:
        text(
          'status_tag'
        )
          .notNull()
          .default(''),
      summary:
        text('summary')
          .notNull()
          .default(''),
      ticket:
        text('ticket')
          .notNull()
          .default(''),
      position:
        integer(
          'position'
        )
          .notNull()
          .default(0),
    },
    (table) => [
      index(
        'idx_impact_incident_position'
      ).on(
        table.incidentId,
        table.position
      ),
    ]
  );

export const cutPoints =
  sqliteTable(
    'cut_points',
    {
      id:
        text('id')
          .primaryKey(),
      incidentId:
        text(
          'incident_id'
        )
          .notNull()
          .references(
            () =>
              incidents.id,
            {
              onDelete:
                'cascade',
            }
          ),
      label:
        text('label')
          .notNull(),
      rootcause:
        text(
          'rootcause'
        )
          .notNull()
          .default(''),
      cutPoint:
        text(
          'cut_point'
        )
          .notNull()
          .default(''),
      marker:
        text('marker')
          .notNull()
          .default(
            'unknown'
          ),
      position:
        integer(
          'position'
        )
          .notNull()
          .default(0),
    },
    (table) => [
      index(
        'idx_cut_point_incident_position'
      ).on(
        table.incidentId,
        table.position
      ),
    ]
  );

export const closureStates =
  sqliteTable(
    'closure_states',
    {
      incidentId:
        text(
          'incident_id'
        )
          .primaryKey()
          .references(
            () =>
              incidents.id,
            {
              onDelete:
                'cascade',
            }
          ),
      statementUpWag:
        integer(
          'statement_up_wag',
          {
            mode: 'boolean',
          }
        )
          .notNull()
          .default(false),
      matoaStatusTt:
        integer(
          'matoa_status_tt',
          {
            mode: 'boolean',
          }
        )
          .notNull()
          .default(false),
      matoaEventAndPhoto:
        integer(
          'matoa_event_and_photo',
          {
            mode: 'boolean',
          }
        )
          .notNull()
          .default(false),
      matoaRfo:
        integer(
          'matoa_rfo',
          {
            mode: 'boolean',
          }
        )
          .notNull()
          .default(false),
      sentClosedEmail:
        integer(
          'sent_closed_email',
          {
            mode: 'boolean',
          }
        )
          .notNull()
          .default(false),
      updatedAt:
        integer(
          'updated_at'
        ).notNull(),
    }
  );

export const recoverySnapshots =
  sqliteTable(
    'recovery_snapshots',
    {
      id:
        text('id')
          .primaryKey(),
      workspaceId:
        text(
          'workspace_id'
        )
          .notNull()
          .references(
            () =>
              workspaces.id,
            {
              onDelete:
                'cascade',
            }
          ),
      incidentId:
        text(
          'incident_id'
        ),
      reason:
        text('reason')
          .notNull(),
      payloadJson:
        text(
          'payload_json'
        )
          .notNull(),
      createdBy:
        text(
          'created_by'
        )
          .notNull()
          .references(
            () =>
              appUsers.uid
          ),
      createdAt:
        integer(
          'created_at'
        ).notNull(),
      expiresAt:
        integer(
          'expires_at'
        ),
    },
    (table) => [
      index(
        'idx_recovery_workspace_created'
      ).on(
        table.workspaceId,
        table.createdAt
      ),
    ]
  );

export const auditEvents =
  sqliteTable(
    'audit_events',
    {
      id:
        text('id')
          .primaryKey(),
      workspaceId:
        text(
          'workspace_id'
        )
          .notNull()
          .references(
            () =>
              workspaces.id,
            {
              onDelete:
                'cascade',
            }
          ),
      incidentId:
        text(
          'incident_id'
        ),
      actorUid:
        text(
          'actor_uid'
        )
          .notNull()
          .references(
            () =>
              appUsers.uid
          ),
      action:
        text('action')
          .notNull(),
      entityType:
        text(
          'entity_type'
        )
          .notNull(),
      entityId:
        text(
          'entity_id'
        )
          .notNull(),
      beforeJson:
        text(
          'before_json'
        ),
      afterJson:
        text(
          'after_json'
        ),
      requestId:
        text(
          'request_id'
        ),
      createdAt:
        integer(
          'created_at'
        ).notNull(),
    },
    (table) => [
      index(
        'idx_audit_workspace_created'
      ).on(
        table.workspaceId,
        table.createdAt
      ),
      index(
        'idx_audit_incident_created'
      ).on(
        table.incidentId,
        table.createdAt
      ),
    ]
  );

export const syncMetadata =
  sqliteTable(
    'sync_metadata',
    {
      key:
        text('key')
          .primaryKey(),
      value:
        text('value')
          .notNull(),
      updatedAt:
        integer(
          'updated_at'
        ).notNull(),
    }
  );
`
);

write(
  'drizzle.config.ts',
  `import {
  defineConfig,
} from 'drizzle-kit';

export default defineConfig({
  schema:
    './lib/server/db/schema.ts',
  out:
    './drizzle',
  dialect:
    'sqlite',
});
`
);

// -----------------------------------------------------------------------------
// INITIAL SQL MIGRATION
// -----------------------------------------------------------------------------

write(
  'drizzle/0000_reportos_core.sql',
  `PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_users (
  uid TEXT PRIMARY KEY NOT NULL,
  email TEXT,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'operator',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY NOT NULL,
  owner_uid TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (owner_uid)
    REFERENCES app_users(uid)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner
  ON workspaces(owner_uid);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL,
  uid TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id)
    REFERENCES workspaces(id)
    ON DELETE CASCADE,
  FOREIGN KEY (uid)
    REFERENCES app_users(uid)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_workspace_member
  ON workspace_members(workspace_id, uid);

CREATE INDEX IF NOT EXISTS idx_workspace_member_uid
  ON workspace_members(uid);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  lifecycle TEXT NOT NULL DEFAULT 'active',
  region TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  ticket TEXT NOT NULL DEFAULT '',
  occur_time TEXT NOT NULL DEFAULT '',
  dispatch_time TEXT NOT NULL DEFAULT '',
  pic TEXT NOT NULL DEFAULT '',
  rootcause TEXT NOT NULL DEFAULT '',
  cut_point TEXT NOT NULL DEFAULT '',
  primary_marker TEXT,
  status_tag TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  FOREIGN KEY (workspace_id)
    REFERENCES workspaces(id)
    ON DELETE CASCADE,
  FOREIGN KEY (created_by)
    REFERENCES app_users(uid),
  FOREIGN KEY (updated_by)
    REFERENCES app_users(uid)
);

CREATE INDEX IF NOT EXISTS idx_incidents_workspace_updated
  ON incidents(workspace_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_incidents_ticket
  ON incidents(ticket);

CREATE INDEX IF NOT EXISTS idx_incidents_lifecycle
  ON incidents(workspace_id, lifecycle);

CREATE TABLE IF NOT EXISTS progress_entries (
  id TEXT PRIMARY KEY NOT NULL,
  incident_id TEXT NOT NULL,
  date TEXT,
  time TEXT NOT NULL,
  text TEXT NOT NULL,
  kind TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (incident_id)
    REFERENCES incidents(id)
    ON DELETE CASCADE,
  FOREIGN KEY (created_by)
    REFERENCES app_users(uid)
);

CREATE INDEX IF NOT EXISTS idx_progress_incident_position
  ON progress_entries(incident_id, position);

CREATE TABLE IF NOT EXISTS impact_links (
  id TEXT PRIMARY KEY NOT NULL,
  incident_id TEXT NOT NULL,
  marker TEXT NOT NULL DEFAULT 'unknown',
  region TEXT NOT NULL DEFAULT '',
  status_tag TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  ticket TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (incident_id)
    REFERENCES incidents(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_impact_incident_position
  ON impact_links(incident_id, position);

CREATE TABLE IF NOT EXISTS cut_points (
  id TEXT PRIMARY KEY NOT NULL,
  incident_id TEXT NOT NULL,
  label TEXT NOT NULL,
  rootcause TEXT NOT NULL DEFAULT '',
  cut_point TEXT NOT NULL DEFAULT '',
  marker TEXT NOT NULL DEFAULT 'unknown',
  position INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (incident_id)
    REFERENCES incidents(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cut_point_incident_position
  ON cut_points(incident_id, position);

CREATE TABLE IF NOT EXISTS closure_states (
  incident_id TEXT PRIMARY KEY NOT NULL,
  statement_up_wag INTEGER NOT NULL DEFAULT 0,
  matoa_status_tt INTEGER NOT NULL DEFAULT 0,
  matoa_event_and_photo INTEGER NOT NULL DEFAULT 0,
  matoa_rfo INTEGER NOT NULL DEFAULT 0,
  sent_closed_email INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (incident_id)
    REFERENCES incidents(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recovery_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  incident_id TEXT,
  reason TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  FOREIGN KEY (workspace_id)
    REFERENCES workspaces(id)
    ON DELETE CASCADE,
  FOREIGN KEY (created_by)
    REFERENCES app_users(uid)
);

CREATE INDEX IF NOT EXISTS idx_recovery_workspace_created
  ON recovery_snapshots(workspace_id, created_at);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  incident_id TEXT,
  actor_uid TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  request_id TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id)
    REFERENCES workspaces(id)
    ON DELETE CASCADE,
  FOREIGN KEY (actor_uid)
    REFERENCES app_users(uid)
);

CREATE INDEX IF NOT EXISTS idx_audit_workspace_created
  ON audit_events(workspace_id, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_incident_created
  ON audit_events(incident_id, created_at);

CREATE TABLE IF NOT EXISTS sync_metadata (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`
);

// -----------------------------------------------------------------------------
// ARCHITECTURE DOC IN REPO
// -----------------------------------------------------------------------------

write(
  'docs/REPORTOS_FULLSTACK_ARCHITECTURE.md',
  `# ReportOS Full-Stack Architecture

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
`
);

// -----------------------------------------------------------------------------
// CI QUALITY GATE — LINUX VALIDATES OPENNEXT
// -----------------------------------------------------------------------------

write(
  '.github/workflows/reportos-quality.yml',
  `name: ReportOS Quality

on:
  push:
    branches:
      - main
  pull_request:

permissions:
  contents: read

jobs:
  quality:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Unit tests
        run: npm test

      - name: Next build
        run: npm run build

      - name: Cloudflare Worker build
        run: npm run build:worker
`
);

// -----------------------------------------------------------------------------
// FINAL VALIDATION
// -----------------------------------------------------------------------------

const validations = [
  [
    'next.config.mjs',
    'initOpenNextCloudflareForDev',
  ],
  [
    'next.config.mjs',
    "root: process.cwd()",
  ],
  [
    'open-next.config.ts',
    'defineCloudflareConfig',
  ],
  [
    'wrangler.jsonc',
    '"name": "reportos"',
  ],
  [
    'app/api/health/route.ts',
    "architecture:",
  ],
  [
    'lib/contracts/system.ts',
    'systemHealthSchema',
  ],
  [
    'lib/server/db/schema.ts',
    'export const incidents',
  ],
  [
    'drizzle/0000_reportos_core.sql',
    'CREATE TABLE IF NOT EXISTS incidents',
  ],
  [
    '.github/workflows/reportos-quality.yml',
    'Cloudflare Worker build',
  ],
];

for (const [relativePath, token] of validations) {
  if (!read(relativePath).includes(token)) {
    throw new Error(
      `Validation failed: ${token} missing from ${relativePath}`
    );
  }
}

if (
  read('next.config.mjs').includes(
    "output: 'export'"
  )
) {
  throw new Error(
    'Validation failed: Next.js is still configured for static export.'
  );
}

console.log('');
console.log(
  'FS-0 ReportOS full-stack foundation applied.'
);
console.log(
  'Next.js static export removed; OpenNext Cloudflare runtime configured.'
);
console.log(
  'Server health route, D1/Drizzle schema foundation, migration, CI and architecture docs created.'
);
console.log(
  'Existing Firebase Auth/Firestore recovery remains intact.'
);
console.log(
  'Install the declared foundation packages next, then run quality gates.'
);
