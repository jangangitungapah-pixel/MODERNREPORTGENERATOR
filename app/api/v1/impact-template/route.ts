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
  reportOsDb,
} from '@/lib/server/db/d1';

import {
  ApiError,
  errorResponse,
  requestId,
} from '@/lib/server/http/api-response';

export const dynamic =
  'force-dynamic';

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
  expectedRevision: z
    .number()
    .int()
    .min(0),
});

type StoredImpactTemplate = {
  version: 1;
  revision: number;
  draft: z.infer<typeof draftSchema>;
  updatedAt: number;
  updatedBy: string;
};

type MetadataRow = {
  value: string;
  updated_at: number;
};

function metadataKey(
  uid: string
): string {
  return `impact-template:${uid}:v1`;
}

function parseStoredTemplate(
  raw: string
): StoredImpactTemplate | null {
  try {
    const parsed = JSON.parse(raw) as Partial<StoredImpactTemplate>;

    if (
      parsed.version !== 1 ||
      typeof parsed.revision !== 'number' ||
      !Number.isInteger(parsed.revision) ||
      parsed.revision < 1 ||
      typeof parsed.updatedAt !== 'number' ||
      typeof parsed.updatedBy !== 'string'
    ) {
      return null;
    }

    const draft = draftSchema.safeParse(
      parsed.draft
    );

    if (!draft.success) {
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

export async function GET(
  request: Request
) {
  const id = requestId();

  try {
    const principal =
      await requireFirebasePrincipal(
        request
      );

    const key = metadataKey(
      principal.uid
    );

    const row =
      await reportOsDb()
        .prepare(
          `SELECT value, updated_at
           FROM sync_metadata
           WHERE key = ?
           LIMIT 1`
        )
        .bind(key)
        .first<MetadataRow>();

    if (!row) {
      return NextResponse.json(
        {
          ok: true,
          requestId: id,
          template: null,
          revision: 0,
          updatedAt: null,
        },
        {
          headers: {
            'Cache-Control': 'no-store',
            'X-Request-Id': id,
          },
        }
      );
    }

    const stored =
      parseStoredTemplate(
        row.value
      );

    if (!stored) {
      throw new ApiError(
        500,
        'INVALID_IMPACT_TEMPLATE',
        'Stored Impact Board template is invalid.'
      );
    }

    return NextResponse.json(
      {
        ok: true,
        requestId: id,
        template: stored.draft,
        revision: stored.revision,
        updatedAt: stored.updatedAt,
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

    const db = reportOsDb();
    const key = metadataKey(
      principal.uid
    );

    const currentRow =
      await db
        .prepare(
          `SELECT value, updated_at
           FROM sync_metadata
           WHERE key = ?
           LIMIT 1`
        )
        .bind(key)
        .first<MetadataRow>();

    const current = currentRow
      ? parseStoredTemplate(
          currentRow.value
        )
      : null;

    if (
      currentRow &&
      !current
    ) {
      throw new ApiError(
        500,
        'INVALID_IMPACT_TEMPLATE',
        'Stored Impact Board template is invalid.'
      );
    }

    const currentRevision =
      current?.revision ?? 0;

    if (
      body.data.expectedRevision !==
      currentRevision
    ) {
      throw new ApiError(
        409,
        'REVISION_CONFLICT',
        'Impact Board template changed in another session.'
      );
    }

    const now = Date.now();
    const next: StoredImpactTemplate = {
      version: 1,
      revision:
        currentRevision + 1,
      draft: body.data.draft,
      updatedAt: now,
      updatedBy: principal.uid,
    };

    const nextValue =
      JSON.stringify(next);

    if (currentRow) {
      const result =
        await db
          .prepare(
            `UPDATE sync_metadata
             SET value = ?, updated_at = ?
             WHERE key = ? AND value = ?`
          )
          .bind(
            nextValue,
            now,
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
          'Impact Board template changed while saving.'
        );
      }
    } else {
      const result =
        await db
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
          'Impact Board template was created in another session.'
        );
      }
    }

    return NextResponse.json(
      {
        ok: true,
        requestId: id,
        template: next.draft,
        revision: next.revision,
        updatedAt: next.updatedAt,
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
