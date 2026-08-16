import {
  deserializeWorkspace,
  type WorkspaceSnapshot,
} from '@/lib/workspace';

import {
  type AuthenticatedPrincipal,
} from '@/lib/server/auth/firebase-rest-auth';

import {
  reportOsDb,
} from '@/lib/server/db/d1';

import {
  ApiError,
} from '@/lib/server/http/api-response';

export type WorkspaceRole =
  | 'operator'
  | 'supervisor'
  | 'admin';

export type WorkspaceContext = {
  id: string;
  name: string;
  role: WorkspaceRole;
};

export type CanonicalWorkspace = {
  workspace: WorkspaceSnapshot | null;
  revision: number;
  checksum: string | null;
  updatedAt: number | null;
  updatedBy: string | null;
};

type WorkspaceStateRow = {
  payload_json: string;
  revision: number;
  checksum: string;
  updated_at: number;
  updated_by: string;
};

function personalWorkspaceId(
  uid: string
): string {
  return `workspace-${uid}`;
}

function isRole(
  value: unknown
): value is WorkspaceRole {
  return (
    value === 'operator' ||
    value === 'supervisor' ||
    value === 'admin'
  );
}

async function checksum(
  value: string
): Promise<string> {
  const digest =
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(
        value
      )
    );

  return Array.from(
    new Uint8Array(digest)
  )
    .map((byte) =>
      byte
        .toString(16)
        .padStart(2, '0')
    )
    .join('');
}

function randomId(
  prefix: string
): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export async function ensureWorkspaceContext(
  principal: AuthenticatedPrincipal
): Promise<WorkspaceContext> {
  const db = reportOsDb();
  const now = Date.now();
  const workspaceId =
    personalWorkspaceId(
      principal.uid
    );

  await db
    .prepare(
      `INSERT INTO app_users (
        uid,
        email,
        display_name,
        role,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, 'admin', ?, ?)
      ON CONFLICT(uid) DO UPDATE SET
        email = excluded.email,
        display_name = excluded.display_name,
        updated_at = excluded.updated_at`
    )
    .bind(
      principal.uid,
      principal.email,
      principal.displayName,
      now,
      now
    )
    .run();

  await db
    .prepare(
      `INSERT OR IGNORE INTO workspaces (
        id,
        owner_uid,
        name,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?)`
    )
    .bind(
      workspaceId,
      principal.uid,
      'ReportOS Workspace',
      now,
      now
    )
    .run();

  await db
    .prepare(
      `INSERT OR IGNORE INTO workspace_members (
        workspace_id,
        uid,
        role,
        created_at
      ) VALUES (?, ?, 'admin', ?)`
    )
    .bind(
      workspaceId,
      principal.uid,
      now
    )
    .run();

  const membership =
    await db
      .prepare(
        `SELECT
          w.id AS id,
          w.name AS name,
          m.role AS role
        FROM workspace_members m
        INNER JOIN workspaces w
          ON w.id = m.workspace_id
        WHERE m.workspace_id = ?
          AND m.uid = ?
        LIMIT 1`
      )
      .bind(
        workspaceId,
        principal.uid
      )
      .first<{
        id: string;
        name: string;
        role: unknown;
      }>();

  if (
    !membership ||
    !isRole(
      membership.role
    )
  ) {
    throw new ApiError(
      500,
      'WORKSPACE_BOOTSTRAP_FAILED',
      'ReportOS could not initialize the workspace.'
    );
  }

  return {
    id: membership.id,
    name: membership.name,
    role: membership.role,
  };
}

export async function loadCanonicalWorkspace(
  principal: AuthenticatedPrincipal
): Promise<{
  context: WorkspaceContext;
  canonical: CanonicalWorkspace;
}> {
  const context =
    await ensureWorkspaceContext(
      principal
    );

  const row =
    await reportOsDb()
      .prepare(
        `SELECT
          payload_json,
          revision,
          checksum,
          updated_at,
          updated_by
        FROM workspace_states
        WHERE workspace_id = ?
        LIMIT 1`
      )
      .bind(
        context.id
      )
      .first<WorkspaceStateRow>();

  if (!row) {
    return {
      context,
      canonical: {
        workspace: null,
        revision: 0,
        checksum: null,
        updatedAt: null,
        updatedBy: null,
      },
    };
  }

  const workspace =
    deserializeWorkspace(
      row.payload_json
    );

  if (!workspace) {
    throw new ApiError(
      500,
      'CANONICAL_STATE_CORRUPT',
      'The canonical ReportOS workspace failed validation.'
    );
  }

  return {
    context,
    canonical: {
      workspace,
      revision: row.revision,
      checksum: row.checksum,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
    },
  };
}

export async function saveCanonicalWorkspace({
  principal,
  workspaceRaw,
  expectedRevision,
  requestId,
  reason,
}: {
  principal: AuthenticatedPrincipal;
  workspaceRaw: string;
  expectedRevision: number;
  requestId: string;
  reason: string;
}): Promise<{
  context: WorkspaceContext;
  canonical: CanonicalWorkspace;
}> {
  const workspace =
    deserializeWorkspace(
      workspaceRaw
    );

  if (!workspace) {
    throw new ApiError(
      400,
      'INVALID_WORKSPACE',
      'Workspace payload failed validation.'
    );
  }

  if (
    workspaceRaw.length >
    850_000
  ) {
    throw new ApiError(
      413,
      'WORKSPACE_TOO_LARGE',
      'Workspace payload is too large.'
    );
  }

  const context =
    await ensureWorkspaceContext(
      principal
    );

  const db = reportOsDb();
  const now = Date.now();
  const nextChecksum =
    await checksum(
      workspaceRaw
    );

  const previous =
    await db
      .prepare(
        `SELECT
          payload_json,
          revision,
          checksum,
          updated_at,
          updated_by
        FROM workspace_states
        WHERE workspace_id = ?
        LIMIT 1`
      )
      .bind(
        context.id
      )
      .first<WorkspaceStateRow>();

  const currentRevision =
    previous?.revision ?? 0;

  if (
    expectedRevision !==
    currentRevision
  ) {
    throw new ApiError(
      409,
      'REVISION_CONFLICT',
      'A newer workspace revision already exists.'
    );
  }

  if (
    previous?.checksum ===
    nextChecksum
  ) {
    return {
      context,
      canonical: {
        workspace,
        revision:
          previous.revision,
        checksum:
          previous.checksum,
        updatedAt:
          previous.updated_at,
        updatedBy:
          previous.updated_by,
      },
    };
  }

  const nextRevision =
    currentRevision + 1;

  if (previous) {
    await db
      .prepare(
        `INSERT INTO recovery_snapshots (
          id,
          workspace_id,
          incident_id,
          reason,
          payload_json,
          created_by,
          created_at,
          expires_at
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, NULL)`
      )
      .bind(
        randomId('snapshot'),
        context.id,
        reason,
        previous.payload_json,
        principal.uid,
        now
      )
      .run();
  }

  const writeResult =
    previous
      ? await db
          .prepare(
            `UPDATE workspace_states SET
              active_incident_id = ?,
              payload_json = ?,
              revision = ?,
              checksum = ?,
              updated_at = ?,
              updated_by = ?
            WHERE workspace_id = ?
              AND revision = ?`
          )
          .bind(
            workspace.activeIncidentId,
            workspaceRaw,
            nextRevision,
            nextChecksum,
            now,
            principal.uid,
            context.id,
            currentRevision
          )
          .run()
      : await db
          .prepare(
            `INSERT OR IGNORE INTO workspace_states (
              workspace_id,
              active_incident_id,
              payload_json,
              revision,
              checksum,
              created_at,
              updated_at,
              updated_by
            ) VALUES (?, ?, ?, 1, ?, ?, ?, ?)`
          )
          .bind(
            context.id,
            workspace.activeIncidentId,
            workspaceRaw,
            nextChecksum,
            now,
            now,
            principal.uid
          )
          .run();

  if (
    writeResult.meta?.changes === 0
  ) {
    throw new ApiError(
      409,
      'REVISION_CONFLICT',
      'A newer workspace revision already exists.'
    );
  }

  await db
    .prepare(
      `INSERT INTO audit_events (
        id,
        workspace_id,
        incident_id,
        actor_uid,
        action,
        entity_type,
        entity_id,
        before_json,
        after_json,
        request_id,
        created_at
      ) VALUES (?, ?, NULL, ?, ?, 'workspace', ?, ?, ?, ?, ?)`
    )
    .bind(
      randomId('audit'),
      context.id,
      principal.uid,
      currentRevision === 0
        ? 'workspace.created'
        : 'workspace.saved',
      context.id,
      previous
        ? JSON.stringify({
            revision:
              previous.revision,
            checksum:
              previous.checksum,
          })
        : null,
      JSON.stringify({
        revision:
          nextRevision,
        checksum:
          nextChecksum,
        incidentCount:
          workspace.incidents.length,
      }),
      requestId,
      now
    )
    .run();

  return {
    context,
    canonical: {
      workspace,
      revision:
        nextRevision,
      checksum:
        nextChecksum,
      updatedAt: now,
      updatedBy:
        principal.uid,
    },
  };
}
