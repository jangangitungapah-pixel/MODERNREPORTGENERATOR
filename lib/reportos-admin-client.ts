'use client';

import {
  ensureFirebaseUser,
} from './firebase-client';

export type SystemSession = {
  requestId: string;
  timestamp: string;
  user: {
    uid: string;
    email: string | null;
    displayName: string | null;
    provider: string;
    anonymous: boolean;
  };
  workspace: {
    id: string;
    name: string;
    role:
      | 'operator'
      | 'supervisor'
      | 'admin';
  };
};

export type CanonicalStatus = {
  revision: number;
  checksum: string | null;
  updatedAt: number | null;
  updatedBy: string | null;
  incidentCount: number;
};

export type RecoverySnapshot = {
  id: string;
  reason: string;
  createdAt: number;
  createdBy: string;
  payloadBytes: number;
};

export type AuditEvent = {
  id: string;
  incidentId: string | null;
  actorUid: string;
  action: string;
  entityType: string;
  entityId: string;
  before: string | null;
  after: string | null;
  sourceRequestId: string | null;
  createdAt: number;
};

export class AdminClientError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(
    code: string,
    message: string,
    status: number
  ) {
    super(message);
    this.name =
      'AdminClientError';
    this.code = code;
    this.status = status;
  }
}

async function authFetch(
  input: string,
  init: RequestInit = {}
): Promise<unknown> {
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

  if (init.body) {
    headers.set(
      'Content-Type',
      'application/json'
    );
  }

  const response =
    await fetch(
      input,
      {
        ...init,
        headers,
        cache: 'no-store',
      }
    );

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new AdminClientError(
      'INVALID_RESPONSE',
      'ReportOS server returned an invalid response.',
      response.status
    );
  }

  if (!response.ok) {
    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error ===
        'object' &&
      body.error !== null
    ) {
      const problem =
        body.error as Record<
          string,
          unknown
        >;

      throw new AdminClientError(
        typeof problem.code ===
          'string'
          ? problem.code
          : 'SERVER_ERROR',
        typeof problem.message ===
          'string'
          ? problem.message
          : 'ReportOS server request failed.',
        response.status
      );
    }

    throw new AdminClientError(
      'SERVER_ERROR',
      'ReportOS server request failed.',
      response.status
    );
  }

  return body;
}

export async function loadSystemSession(): Promise<SystemSession> {
  const body =
    (await authFetch(
      '/api/v1/session'
    )) as {
      requestId: string;
      timestamp: string;
      user: SystemSession['user'];
      workspace:
        SystemSession['workspace'];
    };

  return body;
}

export async function loadCanonicalStatus(): Promise<CanonicalStatus> {
  const body =
    (await authFetch(
      '/api/v1/workspace'
    )) as {
      canonical?: {
        workspace?: {
          incidents?: unknown[];
        } | null;
        revision?: number;
        checksum?: string | null;
        updatedAt?: number | null;
        updatedBy?: string | null;
      };
    };

  const canonical =
    body.canonical;

  return {
    revision:
      typeof canonical?.revision ===
        'number'
        ? canonical.revision
        : 0,
    checksum:
      typeof canonical?.checksum ===
        'string'
        ? canonical.checksum
        : null,
    updatedAt:
      typeof canonical?.updatedAt ===
        'number'
        ? canonical.updatedAt
        : null,
    updatedBy:
      typeof canonical?.updatedBy ===
        'string'
        ? canonical.updatedBy
        : null,
    incidentCount:
      Array.isArray(
        canonical?.workspace
          ?.incidents
      )
        ? canonical.workspace
            .incidents.length
        : 0,
  };
}

export async function loadRecoverySnapshots(): Promise<RecoverySnapshot[]> {
  const body =
    (await authFetch(
      '/api/v1/recovery'
    )) as {
      snapshots?: RecoverySnapshot[];
    };

  return Array.isArray(
    body.snapshots
  )
    ? body.snapshots
    : [];
}

export async function restoreRecoverySnapshot(
  snapshotId: string
): Promise<void> {
  await authFetch(
    '/api/v1/recovery',
    {
      method: 'POST',
      body: JSON.stringify({
        snapshotId,
      }),
    }
  );
}

export async function loadAuditEvents(): Promise<AuditEvent[]> {
  const body =
    (await authFetch(
      '/api/v1/audit'
    )) as {
      events?: AuditEvent[];
    };

  return Array.isArray(
    body.events
  )
    ? body.events
    : [];
}
