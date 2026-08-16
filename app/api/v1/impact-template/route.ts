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

const MAX_TEMPLATES = 60;

const statusSchema = z.enum([
  'up',
  'pending',
  'down',
  'warning',
  'unknown',
]);

const serviceSchema = z.object({
  id: z.string().min(1).max(160),
  name: z.string().max(180),
  status: statusSchema,
  note: z.string().max(600),
});

const customerSchema = z.object({
  id: z.string().min(1).max(160),
  name: z.string().max(180),
  status: statusSchema,
  note: z.string().max(600),
  services: z
    .array(serviceSchema)
    .max(250),
});

const draftSchema = z.object({
  title: z.string().max(240),
  customers: z
    .array(customerSchema)
    .max(250),
});

const saveSchema = z.object({
  draft: draftSchema,
  expectedLibraryRevision: z
    .number()
    .int()
    .min(0),
  templateId: z
    .string()
    .min(1)
    .max(160)
    .optional(),
});

type ImpactDraft =
  z.infer<typeof draftSchema>;

type StoredImpactTemplate = {
  id: string;
  name: string;
  revision: number;
  draft: ImpactDraft;
  createdAt: number;
  updatedAt: number;
  updatedBy: string;
};

type StoredImpactTemplateLibrary = {
  version: 1;
  revision: number;
  templates: StoredImpactTemplate[];
  updatedAt: number | null;
  updatedBy: string | null;
};

type LegacyStoredImpactTemplate = {
  version: 1;
  revision: number;
  draft: ImpactDraft;
  updatedAt: number;
  updatedBy: string;
};

type MetadataRow = {
  value: string;
  updated_at: number;
};

type LoadedLibrary = {
  row: MetadataRow | null;
  library: StoredImpactTemplateLibrary;
};

function libraryMetadataKey(
  uid: string
): string {
  return `impact-template-library:${uid}:v1`;
}

function legacyMetadataKey(
  uid: string
): string {
  return `impact-template:${uid}:v1`;
}

function cleanTitle(
  value: string
): string {
  return value
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizedTitle(
  value: string
): string {
  return cleanTitle(value)
    .toLocaleLowerCase('en-US');
}

function parseTemplate(
  value: unknown
): StoredImpactTemplate | null {
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

  const draft = draftSchema.safeParse(
    record.draft
  );

  if (
    typeof record.id !== 'string' ||
    !record.id ||
    typeof record.name !== 'string' ||
    !cleanTitle(record.name) ||
    typeof record.revision !== 'number' ||
    !Number.isInteger(record.revision) ||
    record.revision < 1 ||
    typeof record.createdAt !== 'number' ||
    typeof record.updatedAt !== 'number' ||
    typeof record.updatedBy !== 'string' ||
    !draft.success
  ) {
    return null;
  }

  return {
    id: record.id,
    name: cleanTitle(record.name),
    revision: record.revision,
    draft: draft.data,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    updatedBy: record.updatedBy,
  };
}

function parseStoredLibrary(
  raw: string
): StoredImpactTemplateLibrary | null {
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
      parsed.templates.length > MAX_TEMPLATES ||
      !(
        parsed.updatedAt === null ||
        typeof parsed.updatedAt === 'number'
      ) ||
      !(
        parsed.updatedBy === null ||
        typeof parsed.updatedBy === 'string'
      )
    ) {
      return null;
    }

    const templates =
      parsed.templates.map(
        (template) =>
          parseTemplate(template)
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
        templates as StoredImpactTemplate[],
      updatedAt:
        parsed.updatedAt as number | null,
      updatedBy:
        parsed.updatedBy as string | null,
    };
  } catch {
    return null;
  }
}

function parseLegacyTemplate(
  raw: string
): LegacyStoredImpactTemplate | null {
  try {
    const parsed = JSON.parse(raw) as Record<
      string,
      unknown
    >;

    const draft = draftSchema.safeParse(
      parsed.draft
    );

    if (
      parsed.version !== 1 ||
      typeof parsed.revision !== 'number' ||
      !Number.isInteger(parsed.revision) ||
      parsed.revision < 1 ||
      typeof parsed.updatedAt !== 'number' ||
      typeof parsed.updatedBy !== 'string' ||
      !draft.success
    ) {
      return null;
    }

    return {
      version: 1,
      revision: parsed.revision,
      draft: draft.data,
      updatedAt: parsed.updatedAt,
      updatedBy: parsed.updatedBy,
    };
  } catch {
    return null;
  }
}

function emptyLibrary():
  StoredImpactTemplateLibrary {
  return {
    version: 1,
    revision: 0,
    templates: [],
    updatedAt: null,
    updatedBy: null,
  };
}

function libraryFromLegacy(
  legacy: LegacyStoredImpactTemplate
): StoredImpactTemplateLibrary {
  const name = cleanTitle(
    legacy.draft.title
  );

  if (!name) {
    return {
      ...emptyLibrary(),
      revision: legacy.revision,
      updatedAt: legacy.updatedAt,
      updatedBy: legacy.updatedBy,
    };
  }

  return {
    version: 1,
    revision: legacy.revision,
    templates: [
      {
        id: 'legacy-default',
        name,
        revision: 1,
        draft: {
          ...legacy.draft,
          title: name,
        },
        createdAt: legacy.updatedAt,
        updatedAt: legacy.updatedAt,
        updatedBy: legacy.updatedBy,
      },
    ],
    updatedAt: legacy.updatedAt,
    updatedBy: legacy.updatedBy,
  };
}

async function loadLibrary(
  db: ReportOsD1,
  uid: string
): Promise<LoadedLibrary> {
  const row = await db
    .prepare(
      `SELECT value, updated_at
       FROM sync_metadata
       WHERE key = ?
       LIMIT 1`
    )
    .bind(
      libraryMetadataKey(uid)
    )
    .first<MetadataRow>();

  if (row) {
    const library =
      parseStoredLibrary(
        row.value
      );

    if (!library) {
      throw new ApiError(
        500,
        'INVALID_IMPACT_TEMPLATE_LIBRARY',
        'Stored Impact Board template library is invalid.'
      );
    }

    return {
      row,
      library,
    };
  }

  const legacyRow = await db
    .prepare(
      `SELECT value, updated_at
       FROM sync_metadata
       WHERE key = ?
       LIMIT 1`
    )
    .bind(
      legacyMetadataKey(uid)
    )
    .first<MetadataRow>();

  if (!legacyRow) {
    return {
      row: null,
      library: emptyLibrary(),
    };
  }

  const legacy =
    parseLegacyTemplate(
      legacyRow.value
    );

  if (!legacy) {
    throw new ApiError(
      500,
      'INVALID_IMPACT_TEMPLATE',
      'Stored legacy Impact Board template is invalid.'
    );
  }

  return {
    row: null,
    library:
      libraryFromLegacy(legacy),
  };
}

function templateSummary(
  template: StoredImpactTemplate
) {
  const serviceCount =
    template.draft.customers.reduce(
      (
        total,
        customer
      ) =>
        total +
        customer.services.length,
      0
    );

  return {
    id: template.id,
    name: template.name,
    revision: template.revision,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    customerCount:
      template.draft.customers.length,
    serviceCount,
  };
}

function sortedTemplates(
  templates: StoredImpactTemplate[]
): StoredImpactTemplate[] {
  return [...templates].sort(
    (a, b) =>
      b.updatedAt - a.updatedAt
  );
}

function libraryEnvelope(
  library: StoredImpactTemplateLibrary
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
    revision:
      library.revision,
    updatedAt:
      library.updatedAt,
  };
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
          candidate.id ===
          templateId
      );

    if (!template) {
      throw new ApiError(
        404,
        'IMPACT_TEMPLATE_NOT_FOUND',
        'Saved Impact Board template was not found.'
      );
    }

    return NextResponse.json(
      {
        ok: true,
        requestId: id,
        template: template.draft,
        templateMeta:
          templateSummary(template),
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
        'Impact Board template save request is invalid.'
      );
    }

    const name = cleanTitle(
      body.data.draft.title
    );

    if (!name) {
      throw new ApiError(
        400,
        'TEMPLATE_TITLE_REQUIRED',
        'Give the Impact Board a title before saving it as a template.'
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
        'Impact Board template library changed in another session.'
      );
    }

    const normalizedName =
      normalizedTitle(name);

    const byId =
      body.data.templateId
        ? loaded.library.templates.find(
            (template) =>
              template.id ===
              body.data.templateId
          )
        : undefined;

    const byName =
      loaded.library.templates.find(
        (template) =>
          normalizedTitle(
            template.name
          ) === normalizedName
      );

    const existing =
      byId ?? byName;

    if (
      !existing &&
      loaded.library.templates.length >=
        MAX_TEMPLATES
    ) {
      throw new ApiError(
        409,
        'IMPACT_TEMPLATE_LIBRARY_FULL',
        `Impact Board template library is limited to ${MAX_TEMPLATES} saved templates.`
      );
    }

    if (
      existing &&
      byName &&
      byName.id !== existing.id
    ) {
      throw new ApiError(
        409,
        'TEMPLATE_NAME_CONFLICT',
        'Another saved template already uses this Impact Board title.'
      );
    }

    const now = Date.now();
    const nextTemplate:
      StoredImpactTemplate =
      existing
        ? {
            ...existing,
            name,
            revision:
              existing.revision + 1,
            draft: {
              ...body.data.draft,
              title: name,
            },
            updatedAt: now,
            updatedBy:
              principal.uid,
          }
        : {
            id:
              globalThis.crypto.randomUUID(),
            name,
            revision: 1,
            draft: {
              ...body.data.draft,
              title: name,
            },
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

    const nextLibrary:
      StoredImpactTemplateLibrary = {
      version: 1,
      revision:
        loaded.library.revision + 1,
      templates:
        sortedTemplates(templates),
      updatedAt: now,
      updatedBy: principal.uid,
    };

    const nextValue =
      JSON.stringify(nextLibrary);

    const key =
      libraryMetadataKey(
        principal.uid
      );

    if (loaded.row) {
      const result = await db
        .prepare(
          `UPDATE sync_metadata
           SET value = ?, updated_at = ?
           WHERE key = ? AND value = ?`
        )
        .bind(
          nextValue,
          now,
          key,
          loaded.row.value
        )
        .run();

      if (
        result.meta?.changes !== 1
      ) {
        throw new ApiError(
          409,
          'REVISION_CONFLICT',
          'Impact Board template library changed while saving.'
        );
      }
    } else {
      const result = await db
        .prepare(
          `INSERT OR IGNORE INTO sync_metadata
           (key, value, updated_at)
           VALUES (?, ?, ?)`
        )
        .bind(
          key,
          nextValue,
          now
        )
        .run();

      if (
        result.meta?.changes !== 1
      ) {
        throw new ApiError(
          409,
          'REVISION_CONFLICT',
          'Impact Board template library was created in another session.'
        );
      }
    }

    return NextResponse.json(
      {
        ok: true,
        requestId: id,
        template:
          nextTemplate.draft,
        templateMeta:
          templateSummary(
            nextTemplate
          ),
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
