import {
  NextResponse,
} from 'next/server';

import {
  requireFirebasePrincipal,
} from '@/lib/server/auth/firebase-rest-auth';

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

    const workspace =
      await ensureWorkspaceContext(
        principal
      );

    return NextResponse.json(
      {
        ok: true,
        requestId: id,
        timestamp:
          new Date()
            .toISOString(),
        user: principal,
        workspace,
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
