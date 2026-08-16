import {
  NextResponse,
} from 'next/server';

import {
  z,
} from 'zod';

import {
  requireFirebasePrincipal,
} from '@/lib/server/auth/firebase-rest-auth';

import {
  reportOsDb,
} from '@/lib/server/db/d1';

import {
  ensureWorkspaceContext,
  loadCanonicalWorkspace,
  saveCanonicalWorkspace,
} from '@/lib/server/workspace-service';

import {
  ApiError,
  errorResponse,
  requestId,
} from '@/lib/server/http/api-response';

export const dynamic =
  'force-dynamic';

const restoreSchema =
  z.object({
    snapshotId:
      z.string().min(1),
  });

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

    const result =
      await reportOsDb()
        .prepare(
          `SELECT
            id,
            reason,
            created_at,
            created_by,
            length(payload_json) AS payload_bytes
          FROM recovery_snapshots
          WHERE workspace_id = ?
          ORDER BY created_at DESC
          LIMIT 24`
        )
        .bind(context.id)
        .all<{
          id: string;
          reason: string;
          created_at: number;
          created_by: string;
          payload_bytes: number;
        }>();

    return NextResponse.json(
      {
        ok: true,
        requestId: id,
        snapshots:
          result.results.map(
            (row) => ({
              id: row.id,
              reason:
                row.reason,
              createdAt:
                row.created_at,
              createdBy:
                row.created_by,
              payloadBytes:
                row.payload_bytes,
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

export async function POST(
  request: Request
) {
  const id = requestId();

  try {
    const principal =
      await requireFirebasePrincipal(
        request
      );

    const body =
      restoreSchema.safeParse(
        await request.json()
      );

    if (!body.success) {
      throw new ApiError(
        400,
        'INVALID_REQUEST',
        'Recovery restore request is invalid.'
      );
    }

    const context =
      await ensureWorkspaceContext(
        principal
      );

    const snapshot =
      await reportOsDb()
        .prepare(
          `SELECT payload_json
          FROM recovery_snapshots
          WHERE id = ?
            AND workspace_id = ?
          LIMIT 1`
        )
        .bind(
          body.data.snapshotId,
          context.id
        )
        .first<{
          payload_json: string;
        }>();

    if (!snapshot) {
      throw new ApiError(
        404,
        'SNAPSHOT_NOT_FOUND',
        'Recovery snapshot was not found.'
      );
    }

    const current =
      await loadCanonicalWorkspace(
        principal
      );

    const restored =
      await saveCanonicalWorkspace({
        principal,
        workspaceRaw:
          snapshot.payload_json,
        expectedRevision:
          current.canonical.revision,
        requestId: id,
        reason:
          'Safety snapshot before recovery restore',
      });

    return NextResponse.json(
      {
        ok: true,
        requestId: id,
        ...restored,
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
