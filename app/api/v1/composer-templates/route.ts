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
  type ReportOsD1,
  reportOsDb,
} from '@/lib/server/db/d1';

import {
  ApiError,
  errorResponse,
  requestId,
} from '@/lib/server/http/api-response';

export const dynamic =
  'force-dynamic';

const MAX_TEMPLATES = 80;

const markerSchema = z.enum([
  'up',
  'down',
  'warning',
  'unknown',
]);

const progressSchema = z.object({
  id: z.string().min(1).max(180),
  date: z.string().max(40).optional(),
  time: z.string().max(40),
  text: z.string().max(4000),
});

const impactLinkSchema = z.object({
  id: z.string().min(1).max(180),
  marker: markerSchema,
  region: z.string().max(240),
  statusTag: z.string().max(180),
  summary: z.string().max(2000),
  ticket: z.string().max(240),
});

const cutPointSchema = z.object({
  id: z.string().min(1).max(180),
  label: z.string().max(240),
  rootcause: z.string().max(3000),
  cutPoint: z.string().max(3000),
  marker: markerSchema,
});

const reportSchema = z.object({
  region: z.string().max(240),
  summary: z.string().max(4000),
  ticket: z.string().max(240),
  occurTime: z.string().max(80),
  dispatchTime: z.string().max(80),
  pic: z.string().max(600),
  rootcause: z.string().max(5000),
  cutPoint: z.string().max(5000),
  progress: z.array(progressSchema).max(800),
  primaryMarker: markerSchema.optional(),
  statusTag: z.string().max(180).optional(),
  impactLinks: z
    .array(impactLinkSchema)
    .max(250)
    .optional(),
  cutPoints: z
    .array(cutPointSchema)
    .max(250)
    .optional(),
});

const saveSchema = z.object({
  name: z.string().min(1).max(180),
  report: reportSchema,
  expectedLibraryRevision: z
    .number()
    .int()
    .min(0),
  templateId: z
    .string()
    .min(1)
    .max(180)
    .optional(),
});

const deleteSchema = z.object({
  templateId: z
    .string()
    .min(1)
    .max(180),
  expectedLibraryRevision: z
    .number()
    .int()
    .min(0),
});

type IncidentTemplateReport =
  z.infer<typeof reportSchema>;

type StoredComposerTemplate = {
  id: string;
  name: string;
  revision: number;
  report: IncidentTemplateReport;
  createdAt: number;
  updatedAt: number;
  updatedBy: string;
};

type StoredComposerTemplateLibrary = {
  version: 1;
  revision: number;
  templates: StoredComposerTemplate[];
  updatedAt: number | null;
  updatedBy: string | null;
};

type MetadataRow = {
  value: string;
  updated_at: number;
};

function metadataKey(
  uid: string
): string {
  return `composer-template-library:${uid}:v1`;
}

function cleanName(
  value: string
): string {
  return value
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizedName(
  value: string
): string {
  return cleanName(value)
    .toLocaleLowerCase('en-US');
}

function emptyLibrary():
  StoredComposerTemplateLibrary {
  return {
    version: 1,
    revision: 0,
    templates: [],
    updatedAt: null,
    updatedBy: null,
  };
}

function parseTemplate(
  value: unknown
): StoredComposerTemplate | null {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return null;
  }

  const record = value as Record<
    string,
    unknown
  >;

  const report =
    reportSchema.safeParse(
      record.report
    );

  if (
    typeof record.id !== 'string' ||
    !record.id ||
    typeof record.name !== 'string' ||
    !cleanName(record.name) ||
    typeof record.revision !== 'number' ||
    !Number.isInteger(record.revision) ||
    record.revision < 1 ||
    typeof record.createdAt !== 'number' ||
    typeof record.updatedAt !== 'number' ||
    typeof record.updatedBy !== 'string' ||
    !report.success
  ) {
    return null;
  }

  return {
    id: record.id,
    name: cleanName(record.name),
    revision: record.revision,
    report: report.data,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    updatedBy: record.updatedBy,
  };
}

function parseLibrary(
  raw: string
): StoredComposerTemplateLibrary | null {
  try {
    const parsed = JSON.parse(raw) as Record<
      string,
      unknown
    >;

    if (
      parsed.version !== 1 ||
      typeof parsed.revision !== 'number' ||
      !Number.isInteger(parsed.revision) ||
      parsed.revision < 0 ||
      !Array.isArray(parsed.templates) ||
      parsed.templates.length >
        MAX_TEMPLATES ||
      !(
        parsed.updatedAt === null ||
        typeof parsed.updatedAt ===
          'number'
      ) ||
      !(
        parsed.updatedBy === null ||
        typeof parsed.updatedBy ===
          'string'
      )
    ) {
      return null;
    }

    const templates =
      parsed.templates.map(
        parseTemplate
      );

    if (
      templates.some(
        (template) =>
          template === null
      )
    ) {
      return null;
    }

    return {
      version: 1,
      revision: parsed.revision,
      templates:
        templates as StoredComposerTemplate[],
      updatedAt:
        parsed.updatedAt as number | null,
      updatedBy:
        parsed.updatedBy as string | null,
    };
  } catch {
    return null;
  }
}

async function loadLibrary(
  db: ReportOsD1,
  uid: string
): Promise<{
  row: MetadataRow | null;
  library: StoredComposerTemplateLibrary;
}> {
  const row = await db
    .prepare(
      `SELECT value, updated_at
       FROM sync_metadata
       WHERE key = ?
       LIMIT 1`
    )
    .bind(
      metadataKey(uid)
    )
    .first<MetadataRow>();

  if (!row) {
    return {
      row: null,
      library: emptyLibrary(),
    };
  }

  const library =
    parseLibrary(row.value);

  if (!library) {
    throw new ApiError(
      500,
      'INVALID_COMPOSER_TEMPLATE_LIBRARY',
      'Stored Composer template library is invalid.'
    );
  }

  return {
    row,
    library,
  };
}

function sortedTemplates(
  templates: StoredComposerTemplate[]
): StoredComposerTemplate[] {
  return [...templates].sort(
    (left, right) =>
      right.updatedAt -
      left.updatedAt
  );
}

function templateSummary(
  template: StoredComposerTemplate
) {
  return {
    id: template.id,
    name: template.name,
    revision: template.revision,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    region: template.report.region,
    statusTag:
      template.report.statusTag ?? '',
    progressCount:
      template.report.progress.length,
  };
}

function libraryEnvelope(
  library: StoredComposerTemplateLibrary
) {
  return {
    templates:
      sortedTemplates(
        library.templates
      ).map(
        templateSummary
      ),
    libraryRevision:
      library.revision,
    updatedAt:
      library.updatedAt,
  };
}

async function persistLibrary({
  db,
  uid,
  currentRow,
  library,
}: {
  db: ReportOsD1;
  uid: string;
  currentRow: MetadataRow | null;
  library: StoredComposerTemplateLibrary;
}) {
  const key = metadataKey(uid);
  const value = JSON.stringify(library);
  const updatedAt =
    library.updatedAt ?? Date.now();

  if (currentRow) {
    const result = await db
      .prepare(
        `UPDATE sync_metadata
         SET value = ?, updated_at = ?
         WHERE key = ? AND value = ?`
      )
      .bind(
        value,
        updatedAt,
        key,
        currentRow.value
      )
      .run();

    if (
      result.meta?.changes !== 1
    ) {
      throw new ApiError(
        409,
        'REVISION_CONFLICT',
        'Composer template library changed while saving.'
      );
    }

    return;
  }

  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO sync_metadata
       (key, value, updated_at)
       VALUES (?, ?, ?)`
    )
    .bind(
      key,
      value,
      updatedAt
    )
    .run();

  if (
    result.meta?.changes !== 1
  ) {
    throw new ApiError(
      409,
      'REVISION_CONFLICT',
      'Composer template library was created in another session.'
    );
  }
}

export async function GET(
  request: Request
) {
  const id = requestId();

  try {
    const principal =
      await requireFirebasePrincipal(
        request
      );

    const loaded =
      await loadLibrary(
        reportOsDb(),
        principal.uid
      );

    const templateId =
      new URL(
        request.url
      ).searchParams.get('id');

    if (!templateId) {
      return NextResponse.json(
        {
          ok: true,
          requestId: id,
          ...libraryEnvelope(
            loaded.library
          ),
        },
        {
          headers: {
            'Cache-Control': 'no-store',
            'X-Request-Id': id,
          },
        }
      );
    }

    const template =
      loaded.library.templates.find(
        (candidate) =>
          candidate.id === templateId
      );

    if (!template) {
      throw new ApiError(
        404,
        'COMPOSER_TEMPLATE_NOT_FOUND',
        'Saved Composer template was not found.'
      );
    }

    return NextResponse.json(
      {
        ok: true,
        requestId: id,
        ...libraryEnvelope(
          loaded.library
        ),
        template:
          template.report,
        templateMeta:
          templateSummary(
            template
          ),
      },
      {
        headers: {
          'Cache-Control': 'no-store',
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

    const body = saveSchema.safeParse(
      await request.json()
    );

    if (!body.success) {
      throw new ApiError(
        400,
        'INVALID_REQUEST',
        'Composer template save request is invalid.'
      );
    }

    const name = cleanName(
      body.data.name
    );

    if (!name) {
      throw new ApiError(
        400,
        'INVALID_TEMPLATE_NAME',
        'Composer template name is required.'
      );
    }

    const db = reportOsDb();
    const loaded =
      await loadLibrary(
        db,
        principal.uid
      );

    if (
      body.data.expectedLibraryRevision !==
      loaded.library.revision
    ) {
      throw new ApiError(
        409,
        'REVISION_CONFLICT',
        'Composer template library changed in another session.'
      );
    }

    const now = Date.now();
    const sameName =
      loaded.library.templates.find(
        (template) =>
          normalizedName(
            template.name
          ) ===
          normalizedName(name)
      );

    const existing =
      body.data.templateId
        ? loaded.library.templates.find(
            (template) =>
              template.id ===
              body.data.templateId
          )
        : sameName;

    if (
      body.data.templateId &&
      !existing
    ) {
      throw new ApiError(
        404,
        'COMPOSER_TEMPLATE_NOT_FOUND',
        'Composer template to update was not found.'
      );
    }

    if (
      sameName &&
      existing &&
      sameName.id !== existing.id
    ) {
      throw new ApiError(
        409,
        'TEMPLATE_NAME_CONFLICT',
        'Another Composer template already uses that name.'
      );
    }

    const nextTemplate:
      StoredComposerTemplate =
      existing
        ? {
            ...existing,
            name,
            revision:
              existing.revision + 1,
            report: body.data.report,
            updatedAt: now,
            updatedBy:
              principal.uid,
          }
        : {
            id:
              crypto.randomUUID(),
            name,
            revision: 1,
            report: body.data.report,
            createdAt: now,
            updatedAt: now,
            updatedBy:
              principal.uid,
          };

    const templates =
      existing
        ? loaded.library.templates.map(
            (template) =>
              template.id ===
              existing.id
                ? nextTemplate
                : template
          )
        : [
            nextTemplate,
            ...loaded.library.templates,
          ];

    if (
      templates.length >
      MAX_TEMPLATES
    ) {
      throw new ApiError(
        409,
        'TEMPLATE_LIMIT_REACHED',
        `Composer template library is limited to ${MAX_TEMPLATES} templates.`
      );
    }

    const nextLibrary:
      StoredComposerTemplateLibrary = {
        version: 1,
        revision:
          loaded.library.revision + 1,
        templates:
          sortedTemplates(templates),
        updatedAt: now,
        updatedBy:
          principal.uid,
      };

    await persistLibrary({
      db,
      uid: principal.uid,
      currentRow: loaded.row,
      library: nextLibrary,
    });

    return NextResponse.json(
      {
        ok: true,
        requestId: id,
        ...libraryEnvelope(
          nextLibrary
        ),
        templateMeta:
          templateSummary(
            nextTemplate
          ),
      },
      {
        headers: {
          'Cache-Control': 'no-store',
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

export async function DELETE(
  request: Request
) {
  const id = requestId();

  try {
    const principal =
      await requireFirebasePrincipal(
        request
      );

    const body = deleteSchema.safeParse(
      await request.json()
    );

    if (!body.success) {
      throw new ApiError(
        400,
        'INVALID_REQUEST',
        'Composer template delete request is invalid.'
      );
    }

    const db = reportOsDb();
    const loaded =
      await loadLibrary(
        db,
        principal.uid
      );

    if (
      body.data.expectedLibraryRevision !==
      loaded.library.revision
    ) {
      throw new ApiError(
        409,
        'REVISION_CONFLICT',
        'Composer template library changed in another session.'
      );
    }

    const exists =
      loaded.library.templates.some(
        (template) =>
          template.id ===
          body.data.templateId
      );

    if (!exists) {
      throw new ApiError(
        404,
        'COMPOSER_TEMPLATE_NOT_FOUND',
        'Composer template to delete was not found.'
      );
    }

    const now = Date.now();
    const nextLibrary:
      StoredComposerTemplateLibrary = {
        version: 1,
        revision:
          loaded.library.revision + 1,
        templates:
          loaded.library.templates.filter(
            (template) =>
              template.id !==
              body.data.templateId
          ),
        updatedAt: now,
        updatedBy:
          principal.uid,
      };

    await persistLibrary({
      db,
      uid: principal.uid,
      currentRow: loaded.row,
      library: nextLibrary,
    });

    return NextResponse.json(
      {
        ok: true,
        requestId: id,
        ...libraryEnvelope(
          nextLibrary
        ),
      },
      {
        headers: {
          'Cache-Control': 'no-store',
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
