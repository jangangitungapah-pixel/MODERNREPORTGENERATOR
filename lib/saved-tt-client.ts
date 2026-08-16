'use client';

import {
  ensureFirebaseUser,
} from '@/lib/firebase-client';

import type {
  IncidentRecord,
} from '@/lib/workspace';

export type SavedTTSummary = {
  id: string;
  name: string;
  revision: number;
  savedAt: number;
  updatedAt: number;
  status: 'active' | 'archived';
  region: string;
  ticket: string;
  summary: string;
  pic: string;
  progressCount: number;
};

export type SavedTTLibraryEnvelope = {
  records: SavedTTSummary[];
  libraryRevision: number;
  updatedAt: number | null;
};

export type SavedTTDetailEnvelope =
  SavedTTLibraryEnvelope & {
    incident: IncidentRecord;
    recordMeta: SavedTTSummary;
  };

export type SavedTTSaveEnvelope =
  SavedTTLibraryEnvelope & {
    recordMeta: SavedTTSummary;
  };

export class SavedTTClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor({
    status,
    code,
    message,
  }: {
    status: number;
    code: string;
    message: string;
  }) {
    super(message);
    this.name = 'SavedTTClientError';
    this.status = status;
    this.code = code;
  }
}

async function savedTTFetch(
  path = '',
  init: RequestInit = {}
): Promise<Response> {
  const user = await ensureFirebaseUser();
  const token = await user.getIdToken();
  const headers = new Headers(init.headers);

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

  return fetch(
    `/api/v1/saved-tt${path}`,
    {
      ...init,
      headers,
      cache: 'no-store',
    }
  );
}

async function readJson(
  response: Response
): Promise<Record<string, unknown>> {
  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new SavedTTClientError({
      status: response.status,
      code: 'INVALID_SERVER_RESPONSE',
      message: 'Saved TT server returned invalid JSON.',
    });
  }

  if (!response.ok) {
    const error =
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'object' &&
      body.error !== null
        ? body.error as Record<string, unknown>
        : null;

    throw new SavedTTClientError({
      status: response.status,
      code:
        error &&
        typeof error.code === 'string'
          ? error.code
          : 'SERVER_ERROR',
      message:
        error &&
        typeof error.message === 'string'
          ? error.message
          : 'Saved TT request failed.',
    });
  }

  if (
    typeof body !== 'object' ||
    body === null
  ) {
    throw new SavedTTClientError({
      status: 500,
      code: 'INVALID_SERVER_RESPONSE',
      message: 'Saved TT response is invalid.',
    });
  }

  return body as Record<string, unknown>;
}

function readLibraryEnvelope(
  body: Record<string, unknown>
): SavedTTLibraryEnvelope {
  return {
    records:
      Array.isArray(body.records)
        ? body.records as SavedTTSummary[]
        : [],
    libraryRevision:
      typeof body.libraryRevision === 'number'
        ? body.libraryRevision
        : 0,
    updatedAt:
      typeof body.updatedAt === 'number'
        ? body.updatedAt
        : null,
  };
}

export async function loadSavedTTLibrary(): Promise<
  SavedTTLibraryEnvelope
> {
  return readLibraryEnvelope(
    await readJson(
      await savedTTFetch()
    )
  );
}

export async function loadSavedTTById(
  incidentId: string
): Promise<SavedTTDetailEnvelope> {
  const body = await readJson(
    await savedTTFetch(
      `?id=${encodeURIComponent(incidentId)}`
    )
  );

  if (
    typeof body.incident !== 'object' ||
    body.incident === null ||
    typeof body.recordMeta !== 'object' ||
    body.recordMeta === null
  ) {
    throw new SavedTTClientError({
      status: 500,
      code: 'INVALID_SERVER_RESPONSE',
      message: 'Saved TT detail response is invalid.',
    });
  }

  return {
    ...readLibraryEnvelope(body),
    incident:
      body.incident as IncidentRecord,
    recordMeta:
      body.recordMeta as SavedTTSummary,
  };
}

export async function saveTTToLibrary({
  incident,
  expectedLibraryRevision,
}: {
  incident: IncidentRecord;
  expectedLibraryRevision: number;
}): Promise<SavedTTSaveEnvelope> {
  const body = await readJson(
    await savedTTFetch(
      '',
      {
        method: 'PUT',
        body: JSON.stringify({
          incident,
          expectedLibraryRevision,
        }),
      }
    )
  );

  if (
    typeof body.recordMeta !== 'object' ||
    body.recordMeta === null
  ) {
    throw new SavedTTClientError({
      status: 500,
      code: 'INVALID_SERVER_RESPONSE',
      message: 'Saved TT save response is invalid.',
    });
  }

  return {
    ...readLibraryEnvelope(body),
    recordMeta:
      body.recordMeta as SavedTTSummary,
  };
}

export async function deleteSavedTT({
  incidentId,
  expectedLibraryRevision,
}: {
  incidentId: string;
  expectedLibraryRevision: number;
}): Promise<SavedTTLibraryEnvelope> {
  return readLibraryEnvelope(
    await readJson(
      await savedTTFetch(
        '',
        {
          method: 'DELETE',
          body: JSON.stringify({
            incidentId,
            expectedLibraryRevision,
          }),
        }
      )
    )
  );
}
