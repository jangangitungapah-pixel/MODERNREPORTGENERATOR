'use client';

import {
  ensureFirebaseUser,
} from '@/lib/firebase-client';

import {
  deserializeWorkspace,
  serializeWorkspace,
  type WorkspaceSnapshot,
} from '@/lib/workspace';

export type ServerSyncState =
  | 'connecting'
  | 'synced'
  | 'saving'
  | 'offline'
  | 'conflict'
  | 'unavailable';

export type ServerWorkspaceEnvelope = {
  workspace: WorkspaceSnapshot | null;
  revision: number;
  checksum: string | null;
  updatedAt: number | null;
  updatedBy: string | null;
};

export class ReportOsServerError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;

  constructor({
    status,
    code,
    message,
    requestId,
  }: {
    status: number;
    code: string;
    message: string;
    requestId?: string | null;
  }) {
    super(message);
    this.name =
      'ReportOsServerError';
    this.status = status;
    this.code = code;
    this.requestId =
      requestId ?? null;
  }
}

async function authenticatedFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const user =
    await ensureFirebaseUser();

  const token =
    await user.getIdToken();

  const headers =
    new Headers(
      init.headers
    );

  headers.set(
    'Authorization',
    `Bearer ${token}`
  );

  if (
    init.body &&
    !headers.has(
      'Content-Type'
    )
  ) {
    headers.set(
      'Content-Type',
      'application/json'
    );
  }

  return fetch(
    input,
    {
      ...init,
      headers,
      cache: 'no-store',
    }
  );
}

async function readJson(
  response: Response
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ReportOsServerError({
      status:
        response.status,
      code:
        'INVALID_SERVER_RESPONSE',
      message:
        'ReportOS server returned an invalid response.',
      requestId:
        response.headers.get(
          'x-request-id'
        ),
    });
  }
}

function serverError(
  response: Response,
  body: unknown
): ReportOsServerError {
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof body.error ===
      'object' &&
    body.error !== null
  ) {
    const error =
      body.error as Record<
        string,
        unknown
      >;

    return new ReportOsServerError({
      status:
        response.status,
      code:
        typeof error.code ===
        'string'
          ? error.code
          : 'SERVER_ERROR',
      message:
        typeof error.message ===
        'string'
          ? error.message
          : 'ReportOS server request failed.',
      requestId:
        typeof error.requestId ===
        'string'
          ? error.requestId
          : response.headers.get(
              'x-request-id'
            ),
    });
  }

  return new ReportOsServerError({
    status:
      response.status,
    code:
      'SERVER_ERROR',
    message:
      'ReportOS server request failed.',
    requestId:
      response.headers.get(
        'x-request-id'
      ),
  });
}

export async function loadServerWorkspace(): Promise<
  ServerWorkspaceEnvelope
> {
  const response =
    await authenticatedFetch(
      '/api/v1/workspace'
    );

  const body =
    await readJson(response);

  if (!response.ok) {
    throw serverError(
      response,
      body
    );
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('canonical' in body) ||
    typeof body.canonical !==
      'object' ||
    body.canonical === null
  ) {
    throw new ReportOsServerError({
      status: 500,
      code:
        'INVALID_SERVER_RESPONSE',
      message:
        'Canonical workspace response is invalid.',
    });
  }

  const canonical =
    body.canonical as Record<
      string,
      unknown
    >;

  const workspace =
    canonical.workspace === null
      ? null
      : deserializeWorkspace(
          JSON.stringify(
            canonical.workspace
          )
        );

  if (
    canonical.workspace !==
      null &&
    !workspace
  ) {
    throw new ReportOsServerError({
      status: 500,
      code:
        'INVALID_CANONICAL_WORKSPACE',
      message:
        'Canonical workspace failed client validation.',
    });
  }

  return {
    workspace,
    revision:
      typeof canonical.revision ===
      'number'
        ? canonical.revision
        : 0,
    checksum:
      typeof canonical.checksum ===
      'string'
        ? canonical.checksum
        : null,
    updatedAt:
      typeof canonical.updatedAt ===
      'number'
        ? canonical.updatedAt
        : null,
    updatedBy:
      typeof canonical.updatedBy ===
      'string'
        ? canonical.updatedBy
        : null,
  };
}

export async function saveServerWorkspace({
  workspace,
  expectedRevision,
  reason,
}: {
  workspace: WorkspaceSnapshot;
  expectedRevision: number;
  reason: string;
}): Promise<ServerWorkspaceEnvelope> {
  const response =
    await authenticatedFetch(
      '/api/v1/workspace',
      {
        method: 'PUT',
        body: JSON.stringify({
          workspaceRaw:
            serializeWorkspace(
              workspace
            ),
          expectedRevision,
          reason,
        }),
      }
    );

  const body =
    await readJson(response);

  if (!response.ok) {
    throw serverError(
      response,
      body
    );
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('canonical' in body)
  ) {
    throw new ReportOsServerError({
      status: 500,
      code:
        'INVALID_SERVER_RESPONSE',
      message:
        'Saved workspace response is invalid.',
    });
  }

  const canonical =
    body.canonical as Record<
      string,
      unknown
    >;

  return {
    workspace,
    revision:
      typeof canonical.revision ===
      'number'
        ? canonical.revision
        : expectedRevision + 1,
    checksum:
      typeof canonical.checksum ===
      'string'
        ? canonical.checksum
        : null,
    updatedAt:
      typeof canonical.updatedAt ===
      'number'
        ? canonical.updatedAt
        : Date.now(),
    updatedBy:
      typeof canonical.updatedBy ===
      'string'
        ? canonical.updatedBy
        : null,
  };
}
