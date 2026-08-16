'use client';

import {
  ensureFirebaseUser,
} from '@/lib/firebase-client';

import type {
  IncidentReport,
} from '@/lib/report';

export type ComposerTemplateSummary = {
  id: string;
  name: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
  region: string;
  statusTag: string;
  progressCount: number;
};

export type ComposerTemplateLibraryEnvelope = {
  templates: ComposerTemplateSummary[];
  libraryRevision: number;
  updatedAt: number | null;
};

export type ComposerTemplateDetailEnvelope =
  ComposerTemplateLibraryEnvelope & {
    template: IncidentReport;
    templateMeta: ComposerTemplateSummary;
  };

export type ComposerTemplateSaveEnvelope =
  ComposerTemplateLibraryEnvelope & {
    templateMeta: ComposerTemplateSummary;
  };

export class ComposerTemplateClientError extends Error {
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
      'ComposerTemplateClientError';
    this.status = status;
    this.code = code;
  }
}

async function composerTemplateFetch(
  path = '',
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
    `/api/v1/composer-templates${path}`,
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
    throw new ComposerTemplateClientError({
      status: response.status,
      code: 'INVALID_SERVER_RESPONSE',
      message: 'Composer template server returned invalid JSON.',
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

    throw new ComposerTemplateClientError({
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
          : 'Composer template request failed.',
    });
  }

  if (
    typeof body !== 'object' ||
    body === null
  ) {
    throw new ComposerTemplateClientError({
      status: 500,
      code: 'INVALID_SERVER_RESPONSE',
      message: 'Composer template response is invalid.',
    });
  }

  return body as Record<
    string,
    unknown
  >;
}

function readLibraryEnvelope(
  body: Record<string, unknown>
): ComposerTemplateLibraryEnvelope {
  return {
    templates:
      Array.isArray(body.templates)
        ? body.templates as ComposerTemplateSummary[]
        : [],
    libraryRevision:
      typeof body.libraryRevision ===
        'number'
        ? body.libraryRevision
        : 0,
    updatedAt:
      typeof body.updatedAt ===
        'number'
        ? body.updatedAt
        : null,
  };
}

export async function loadComposerTemplateLibrary(): Promise<
  ComposerTemplateLibraryEnvelope
> {
  return readLibraryEnvelope(
    await readJson(
      await composerTemplateFetch()
    )
  );
}

export async function loadComposerTemplateById(
  templateId: string
): Promise<ComposerTemplateDetailEnvelope> {
  const body = await readJson(
    await composerTemplateFetch(
      `?id=${encodeURIComponent(templateId)}`
    )
  );

  if (
    typeof body.template !== 'object' ||
    body.template === null ||
    typeof body.templateMeta !== 'object' ||
    body.templateMeta === null
  ) {
    throw new ComposerTemplateClientError({
      status: 500,
      code: 'INVALID_SERVER_RESPONSE',
      message: 'Saved Composer template response is invalid.',
    });
  }

  return {
    ...readLibraryEnvelope(body),
    template:
      body.template as IncidentReport,
    templateMeta:
      body.templateMeta as ComposerTemplateSummary,
  };
}

export async function saveComposerTemplate({
  name,
  report,
  expectedLibraryRevision,
  templateId,
}: {
  name: string;
  report: IncidentReport;
  expectedLibraryRevision: number;
  templateId?: string;
}): Promise<ComposerTemplateSaveEnvelope> {
  const body = await readJson(
    await composerTemplateFetch(
      '',
      {
        method: 'PUT',
        body: JSON.stringify({
          name,
          report,
          expectedLibraryRevision,
          ...(templateId
            ? {
                templateId,
              }
            : {}),
        }),
      }
    )
  );

  if (
    typeof body.templateMeta !== 'object' ||
    body.templateMeta === null
  ) {
    throw new ComposerTemplateClientError({
      status: 500,
      code: 'INVALID_SERVER_RESPONSE',
      message: 'Composer template save response is invalid.',
    });
  }

  return {
    ...readLibraryEnvelope(body),
    templateMeta:
      body.templateMeta as ComposerTemplateSummary,
  };
}

export async function deleteComposerTemplate({
  templateId,
  expectedLibraryRevision,
}: {
  templateId: string;
  expectedLibraryRevision: number;
}): Promise<ComposerTemplateLibraryEnvelope> {
  return readLibraryEnvelope(
    await readJson(
      await composerTemplateFetch(
        '',
        {
          method: 'DELETE',
          body: JSON.stringify({
            templateId,
            expectedLibraryRevision,
          }),
        }
      )
    )
  );
}
