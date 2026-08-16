'use client';

import {
  ensureFirebaseUser,
} from '@/lib/firebase-client';

import type {
  BackboneImpactDraft,
} from '@/lib/backbone-impact';

export type ImpactTemplateEnvelope = {
  template: BackboneImpactDraft | null;
  revision: number;
  updatedAt: number | null;
};

export class ImpactTemplateClientError extends Error {
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
    this.name =
      'ImpactTemplateClientError';
    this.status = status;
    this.code = code;
  }
}

async function impactFetch(
  init: RequestInit = {}
): Promise<Response> {
  const user =
    await ensureFirebaseUser();

  const token =
    await user.getIdToken();

  const headers =
    new Headers(init.headers);

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
    '/api/v1/impact-template',
    {
      ...init,
      headers,
      cache: 'no-store',
    }
  );
}

async function readEnvelope(
  response: Response
): Promise<ImpactTemplateEnvelope> {
  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new ImpactTemplateClientError({
      status: response.status,
      code: 'INVALID_SERVER_RESPONSE',
      message: 'Impact template server returned invalid JSON.',
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

    throw new ImpactTemplateClientError({
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
          : 'Impact template request failed.',
    });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('revision' in body)
  ) {
    throw new ImpactTemplateClientError({
      status: 500,
      code: 'INVALID_SERVER_RESPONSE',
      message: 'Impact template response is invalid.',
    });
  }

  const record = body as Record<string, unknown>;

  return {
    template:
      record.template === null ||
      typeof record.template === 'object'
        ? record.template as BackboneImpactDraft | null
        : null,
    revision:
      typeof record.revision === 'number'
        ? record.revision
        : 0,
    updatedAt:
      typeof record.updatedAt === 'number'
        ? record.updatedAt
        : null,
  };
}

export async function loadImpactTemplate(): Promise<
  ImpactTemplateEnvelope
> {
  return readEnvelope(
    await impactFetch()
  );
}

export async function saveImpactTemplate({
  draft,
  expectedRevision,
}: {
  draft: BackboneImpactDraft;
  expectedRevision: number;
}): Promise<ImpactTemplateEnvelope> {
  return readEnvelope(
    await impactFetch({
      method: 'PUT',
      body: JSON.stringify({
        draft,
        expectedRevision,
      }),
    })
  );
}
