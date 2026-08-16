'use client';

import {
  ensureFirebaseUser,
} from '@/lib/firebase-client';

import type {
  BackboneImpactDraft,
} from '@/lib/backbone-impact';

export type ImpactTemplateSummary = {
  id: string;
  name: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
  customerCount: number;
  serviceCount: number;
};

export type ImpactTemplateLibraryEnvelope = {
  templates: ImpactTemplateSummary[];
  libraryRevision: number;
  updatedAt: number | null;
};

export type ImpactTemplateRecordEnvelope =
  ImpactTemplateLibraryEnvelope & {
    template: BackboneImpactDraft;
    templateMeta: ImpactTemplateSummary;
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
  suffix = '',
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
    `/api/v1/impact-template${suffix}`,
    {
      ...init,
      headers,
      cache: 'no-store',
    }
  );
}

async function readBody(
  response: Response
): Promise<Record<string, unknown>> {
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
    body === null
  ) {
    throw new ImpactTemplateClientError({
      status: 500,
      code: 'INVALID_SERVER_RESPONSE',
      message: 'Impact template response is invalid.',
    });
  }

  return body as Record<string, unknown>;
}

function parseSummary(
  value: unknown
): ImpactTemplateSummary | null {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.id !== 'string' ||
    typeof record.name !== 'string' ||
    typeof record.revision !== 'number' ||
    typeof record.createdAt !== 'number' ||
    typeof record.updatedAt !== 'number' ||
    typeof record.customerCount !== 'number' ||
    typeof record.serviceCount !== 'number'
  ) {
    return null;
  }

  return {
    id: record.id,
    name: record.name,
    revision: record.revision,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    customerCount: record.customerCount,
    serviceCount: record.serviceCount,
  };
}

function parseLibrary(
  body: Record<string, unknown>
): ImpactTemplateLibraryEnvelope {
  if (
    !Array.isArray(body.templates) ||
    typeof body.libraryRevision !== 'number'
  ) {
    throw new ImpactTemplateClientError({
      status: 500,
      code: 'INVALID_SERVER_RESPONSE',
      message: 'Impact template library response is invalid.',
    });
  }

  const templates =
    body.templates.map(
      parseSummary
    );

  if (
    templates.some(
      (template) =>
        template === null
    )
  ) {
    throw new ImpactTemplateClientError({
      status: 500,
      code: 'INVALID_SERVER_RESPONSE',
      message: 'Impact template library contains invalid metadata.',
    });
  }

  return {
    templates:
      templates as ImpactTemplateSummary[],
    libraryRevision:
      body.libraryRevision,
    updatedAt:
      typeof body.updatedAt === 'number'
        ? body.updatedAt
        : null,
  };
}

function parseRecord(
  body: Record<string, unknown>
): ImpactTemplateRecordEnvelope {
  const library =
    parseLibrary(body);

  const templateMeta =
    parseSummary(
      body.templateMeta
    );

  if (
    !templateMeta ||
    typeof body.template !== 'object' ||
    body.template === null
  ) {
    throw new ImpactTemplateClientError({
      status: 500,
      code: 'INVALID_SERVER_RESPONSE',
      message: 'Impact template record response is invalid.',
    });
  }

  const template =
    body.template as BackboneImpactDraft;

  if (
    typeof template.title !== 'string' ||
    !Array.isArray(
      template.customers
    )
  ) {
    throw new ImpactTemplateClientError({
      status: 500,
      code: 'INVALID_SERVER_RESPONSE',
      message: 'Impact template draft response is invalid.',
    });
  }

  return {
    ...library,
    template,
    templateMeta,
  };
}

export async function loadImpactTemplateLibrary(): Promise<
  ImpactTemplateLibraryEnvelope
> {
  return parseLibrary(
    await readBody(
      await impactFetch()
    )
  );
}

export async function loadImpactTemplateById(
  templateId: string
): Promise<ImpactTemplateRecordEnvelope> {
  return parseRecord(
    await readBody(
      await impactFetch(
        `?id=${encodeURIComponent(templateId)}`
      )
    )
  );
}

export async function saveImpactTemplate({
  draft,
  expectedLibraryRevision,
  templateId,
}: {
  draft: BackboneImpactDraft;
  expectedLibraryRevision: number;
  templateId?: string;
}): Promise<ImpactTemplateRecordEnvelope> {
  return parseRecord(
    await readBody(
      await impactFetch(
        '',
        {
          method: 'PUT',
          body: JSON.stringify({
            draft,
            expectedLibraryRevision,
            ...(templateId
              ? {
                  templateId,
                }
              : {}),
          }),
        }
      )
    )
  );
}
