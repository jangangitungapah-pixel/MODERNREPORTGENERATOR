import {
  deserializeWorkspace,
  type WorkspaceSnapshot,
} from '@/lib/workspace';

import {
  type AuthenticatedPrincipal,
} from '@/lib/server/auth/firebase-rest-auth';

import {
  reportOsDb,
  type D1Statement,
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

function epochFromIso(
  value: string,
  fallback: number
): number {
  const parsed =
    Date.parse(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

async function runBatches(
  statements: D1Statement[]
): Promise<void> {
  const db = reportOsDb();
  const size = 50;

  for (
    let index = 0;
    index < statements.length;
    index += size
  ) {
    await db.batch(
      statements.slice(
        index,
        index + size
      )
    );
  }
}

async function projectWorkspace({
  context,
  principal,
  workspace,
}: {
  context: WorkspaceContext;
  principal: AuthenticatedPrincipal;
  workspace: WorkspaceSnapshot;
}): Promise<void> {
  const db = reportOsDb();
  const now = Date.now();

  const currentRows =
    await db
      .prepare(
        `SELECT id
        FROM incidents
        WHERE workspace_id = ?`
      )
      .bind(context.id)
      .all<{
        id: string;
      }>();

  const incomingIds =
    new Set(
      workspace.incidents.map(
        (incident) =>
          incident.id
      )
    );

  const statements:
    D1Statement[] = [];

  for (
    const row of
    currentRows.results
  ) {
    if (
      !incomingIds.has(
        row.id
      )
    ) {
      statements.push(
        db
          .prepare(
            `DELETE FROM incidents
            WHERE id = ?
              AND workspace_id = ?`
          )
          .bind(
            row.id,
            context.id
          )
      );
    }
  }

  for (
    const incident of
    workspace.incidents
  ) {
    const report =
      incident.report;

    statements.push(
      db
        .prepare(
          `INSERT INTO incidents (
            id,
            workspace_id,
            lifecycle,
            region,
            summary,
            ticket,
            occur_time,
            dispatch_time,
            pic,
            rootcause,
            cut_point,
            primary_marker,
            status_tag,
            revision,
            created_by,
            updated_by,
            created_at,
            updated_at,
            deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, NULL)
          ON CONFLICT(id) DO UPDATE SET
            workspace_id = excluded.workspace_id,
            lifecycle = excluded.lifecycle,
            region = excluded.region,
            summary = excluded.summary,
            ticket = excluded.ticket,
            occur_time = excluded.occur_time,
            dispatch_time = excluded.dispatch_time,
            pic = excluded.pic,
            rootcause = excluded.rootcause,
            cut_point = excluded.cut_point,
            primary_marker = excluded.primary_marker,
            status_tag = excluded.status_tag,
            revision = incidents.revision + 1,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at,
            deleted_at = NULL`
        )
        .bind(
          incident.id,
          context.id,
          incident.status,
          report.region,
          report.summary,
          report.ticket,
          report.occurTime,
          report.dispatchTime,
          report.pic,
          report.rootcause,
          report.cutPoint,
          report.primaryMarker ??
            null,
          report.statusTag ??
            null,
          principal.uid,
          principal.uid,
          epochFromIso(
            incident.createdAt,
            now
          ),
          epochFromIso(
            incident.updatedAt,
            now
          )
        )
    );

    statements.push(
      db
        .prepare(
          `DELETE FROM progress_entries
          WHERE incident_id = ?`
        )
        .bind(incident.id)
    );

    statements.push(
      db
        .prepare(
          `DELETE FROM impact_links
          WHERE incident_id = ?`
        )
        .bind(incident.id)
    );

    statements.push(
      db
        .prepare(
          `DELETE FROM cut_points
          WHERE incident_id = ?`
        )
        .bind(incident.id)
    );

    for (
      const [
        position,
        progress,
      ] of report.progress.entries()
    ) {
      statements.push(
        db
          .prepare(
            `INSERT INTO progress_entries (
              id,
              incident_id,
              date,
              time,
              text,
              kind,
              position,
              created_by,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`
          )
          .bind(
            progress.id,
            incident.id,
            progress.date ??
              null,
            progress.time,
            progress.text,
            position,
            principal.uid,
            epochFromIso(
              incident.updatedAt,
              now
            ),
            epochFromIso(
              incident.updatedAt,
              now
            )
          )
      );
    }

    for (
      const [
        position,
        impact,
      ] of (
        report.impactLinks ??
        []
      ).entries()
    ) {
      statements.push(
        db
          .prepare(
            `INSERT INTO impact_links (
              id,
              incident_id,
              marker,
              region,
              status_tag,
              summary,
              ticket,
              position
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            impact.id,
            incident.id,
            impact.marker,
            impact.region,
            impact.statusTag,
            impact.summary,
            impact.ticket,
            position
          )
      );
    }

    for (
      const [
        position,
        cutPoint,
      ] of (
        report.cutPoints ??
        []
      ).entries()
    ) {
      statements.push(
        db
          .prepare(
            `INSERT INTO cut_points (
              id,
              incident_id,
              label,
              rootcause,
              cut_point,
              marker,
              position
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            cutPoint.id,
            incident.id,
            cutPoint.label,
            cutPoint.rootcause,
            cutPoint.cutPoint,
            cutPoint.marker,
            position
          )
      );
    }

    statements.push(
      db
        .prepare(
          `INSERT INTO closure_states (
            incident_id,
            statement_up_wag,
            matoa_status_tt,
            matoa_event_and_photo,
            matoa_rfo,
            sent_closed_email,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(incident_id) DO UPDATE SET
            statement_up_wag = excluded.statement_up_wag,
            matoa_status_tt = excluded.matoa_status_tt,
            matoa_event_and_photo = excluded.matoa_event_and_photo,
            matoa_rfo = excluded.matoa_rfo,
            sent_closed_email = excluded.sent_closed_email,
            updated_at = excluded.updated_at`
        )
        .bind(
          incident.id,
          incident.closureChecklist
            .statementUpWag
            ? 1
            : 0,
          incident.closureChecklist
            .matoaClearance
            .statusTt
            ? 1
            : 0,
          incident.closureChecklist
            .matoaClearance
            .eventAndPhoto
            ? 1
            : 0,
          incident.closureChecklist
            .matoaClearance
            .rfo
            ? 1
            : 0,
          incident.closureChecklist
            .sentClosedEmail
            ? 1
            : 0,
          epochFromIso(
            incident.updatedAt,
            now
          )
        )
    );
  }

  statements.push(
    db
      .prepare(
        `UPDATE workspaces
        SET updated_at = ?
        WHERE id = ?`
      )
      .bind(
        now,
        context.id
      )
  );

  await runBatches(
    statements
  );
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
    await projectWorkspace({
      context,
      principal,
      workspace,
    });

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

  await projectWorkspace({
    context,
    principal,
    workspace,
  });

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
