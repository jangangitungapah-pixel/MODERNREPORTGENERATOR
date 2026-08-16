import {
  NextResponse,
} from 'next/server';

import {
  requireFirebasePrincipal,
} from '@/lib/server/auth/firebase-rest-auth';

import {
  reportOsDb,
} from '@/lib/server/db/d1';

import {
  ensureWorkspaceContext,
} from '@/lib/server/workspace-service';

import {
  errorResponse,
  requestId,
} from '@/lib/server/http/api-response';

export const dynamic =
  'force-dynamic';

type IncidentListRow = {
  id: string;
  lifecycle: string;
  region: string;
  summary: string;
  ticket: string;
  pic: string;
  rootcause: string;
  cut_point: string;
  primary_marker: string | null;
  status_tag: string | null;
  revision: number;
  updated_at: number;
  progress_count: number;
  closure_done: number;
};

function normalizedLimit(
  value: string | null
): number {
  const parsed =
    Number(value);

  if (!Number.isFinite(parsed)) {
    return 50;
  }

  return Math.max(
    1,
    Math.min(
      100,
      Math.trunc(parsed)
    )
  );
}

export async function GET(
  request: Request
) {
  const id = requestId();

  try {
    const principal =
      await requireFirebasePrincipal(
        request
      );

    const context =
      await ensureWorkspaceContext(
        principal
      );

    const url =
      new URL(request.url);

    const q =
      url.searchParams
        .get('q')
        ?.trim()
        .toLowerCase() ??
      '';

    const requestedStatus =
      url.searchParams.get(
        'status'
      );

    const status =
      requestedStatus ===
        'archived'
        ? 'archived'
        : requestedStatus ===
            'active'
          ? 'active'
          : null;

    const limit =
      normalizedLimit(
        url.searchParams.get(
          'limit'
        )
      );

    const pattern =
      `%${q}%`;

    const result =
      await reportOsDb()
        .prepare(
          `SELECT
            i.id,
            i.lifecycle,
            i.region,
            i.summary,
            i.ticket,
            i.pic,
            i.rootcause,
            i.cut_point,
            i.primary_marker,
            i.status_tag,
            i.revision,
            i.updated_at,
            (
              SELECT COUNT(*)
              FROM progress_entries p
              WHERE p.incident_id = i.id
            ) AS progress_count,
            (
              COALESCE(c.statement_up_wag, 0) +
              COALESCE(c.matoa_status_tt, 0) +
              COALESCE(c.matoa_event_and_photo, 0) +
              COALESCE(c.matoa_rfo, 0) +
              COALESCE(c.sent_closed_email, 0)
            ) AS closure_done
          FROM incidents i
          LEFT JOIN closure_states c
            ON c.incident_id = i.id
          WHERE i.workspace_id = ?
            AND i.deleted_at IS NULL
            AND (? IS NULL OR i.lifecycle = ?)
            AND (
              ? = '' OR
              lower(i.ticket) LIKE ? OR
              lower(i.region) LIKE ? OR
              lower(i.summary) LIKE ? OR
              lower(i.pic) LIKE ? OR
              lower(i.rootcause) LIKE ?
            )
          ORDER BY i.updated_at DESC
          LIMIT ?`
        )
        .bind(
          context.id,
          status,
          status,
          q,
          pattern,
          pattern,
          pattern,
          pattern,
          pattern,
          limit
        )
        .all<IncidentListRow>();

    return NextResponse.json(
      {
        ok: true,
        requestId: id,
        workspace: {
          id: context.id,
          role: context.role,
        },
        query: {
          q,
          status,
          limit,
        },
        incidents:
          result.results.map(
            (row) => ({
              id: row.id,
              lifecycle:
                row.lifecycle,
              region: row.region,
              summary:
                row.summary,
              ticket: row.ticket,
              pic: row.pic,
              rootcause:
                row.rootcause,
              cutPoint:
                row.cut_point,
              primaryMarker:
                row.primary_marker,
              statusTag:
                row.status_tag,
              revision:
                row.revision,
              updatedAt:
                row.updated_at,
              progressCount:
                row.progress_count,
              closureDone:
                row.closure_done,
              closureTotal: 5,
            })
          ),
      },
      {
        headers: {
          'Cache-Control':
            'no-store',
          'X-Request-Id': id,
        },
      }
    );
  } catch (error) {
    return errorResponse(
      error,
      id
    );
  }
}
