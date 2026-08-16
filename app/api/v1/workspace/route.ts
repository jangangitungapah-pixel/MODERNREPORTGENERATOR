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

const saveSchema =
  z.object({
    workspaceRaw:
      z.string().min(1),
    expectedRevision:
      z.number()
        .int()
        .min(0),
    reason:
      z.string()
        .trim()
        .min(1)
        .max(160)
        .default(
          'Canonical workspace autosave'
        ),
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

    const result =
      await loadCanonicalWorkspace(
        principal
      );

    return NextResponse.json(
      {
        ok: true,
        requestId: id,
        ...result,
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

export async function PUT(
  request: Request
) {
  const id = requestId();

  try {
    const principal =
      await requireFirebasePrincipal(
        request
      );

    const body =
      saveSchema.safeParse(
        await request.json()
      );

    if (!body.success) {
      throw new ApiError(
        400,
        'INVALID_REQUEST',
        'Workspace save request is invalid.'
      );
    }

    const result =
      await saveCanonicalWorkspace({
        principal,
        workspaceRaw:
          body.data.workspaceRaw,
        expectedRevision:
          body.data.expectedRevision,
        reason:
          body.data.reason,
        requestId: id,
      });

    return NextResponse.json(
      {
        ok: true,
        requestId: id,
        ...result,
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
