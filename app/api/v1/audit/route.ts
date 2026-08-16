import {
  NextResponse,
} from 'next/server';

import {
  requireFirebasePrincipal,
} from '@/lib/server/auth/firebase-rest-auth';

import {
  requireWorkspaceRole,
} from '@/lib/server/auth/permissions';

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

    requireWorkspaceRole(
      context.role,
      'supervisor'
    );

    const result =
      await reportOsDb()
        .prepare(
          `SELECT
            id,
            incident_id,
            actor_uid,
            action,
            entity_type,
            entity_id,
            before_json,
            after_json,
            request_id,
            created_at
          FROM audit_events
          WHERE workspace_id = ?
          ORDER BY created_at DESC
          LIMIT 100`
        )
        .bind(context.id)
        .all<{
          id: string;
          incident_id: string | null;
          actor_uid: string;
          action: string;
          entity_type: string;
          entity_id: string;
          before_json: string | null;
          after_json: string | null;
          request_id: string | null;
          created_at: number;
        }>();

    return NextResponse.json(
      {
        ok: true,
        requestId: id,
        events:
          result.results.map(
            (row) => ({
              id: row.id,
              incidentId:
                row.incident_id,
              actorUid:
                row.actor_uid,
              action:
                row.action,
              entityType:
                row.entity_type,
              entityId:
                row.entity_id,
              before:
                row.before_json,
              after:
                row.after_json,
              sourceRequestId:
                row.request_id,
              createdAt:
                row.created_at,
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
