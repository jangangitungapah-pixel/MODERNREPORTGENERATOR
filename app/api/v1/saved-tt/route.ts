import {
  NextResponse,
} from 'next/server';

import {
  z,
} from 'zod';

import {
  deserializeWorkspace,
  type IncidentRecord,
} from '@/lib/workspace';

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

const MAX_SAVED_TT = 250;

const saveSchema = z.object({
  incident: z.unknown(),
  expectedLibraryRevision: z
    .number()
    .int()
    .min(0),
});

const deleteSchema = z.object({
  incidentId: z
    .string()
    .min(1)
    .max(220),
  expectedLibraryRevision: z
    .number()
    .int()
    .min(0),
});

type StoredSavedTT = {
  id: string;
  revision: number;
  incident: IncidentRecord;
  savedAt: number;
  createdAt: number;
  updatedAt: number;
  updatedBy: string;
};

type StoredSavedTTLibrary = {
  version: 1;
  revision: number;
  records: StoredSavedTT[];
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
  return `saved-tt-library:${uid}:v1`;
}

function emptyLibrary(): StoredSavedTTLibrary {
  return {
    version: 1,
    revision: 0,
    records: [],
    updatedAt: null,
    updatedBy: null,
  };
}

function parseIncident(
  value: unknown
): IncidentRecord | null {
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

  if (
    typeof record.id !== 'string' ||
    !record.id
  ) {
    return null;
  }

  const workspace =
    deserializeWorkspace(
      JSON.stringify({
        version: 1,
        activeIncidentId: record.id,
        incidents: [value],
      })
    );

  return workspace?.incidents[0] ?? null;
}

function parseStoredRecord(
  value: unknown
): StoredSavedTT | null {
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

  const incident =
    parseIncident(record.incident);

  if (
    typeof record.id !== 'string' ||
    !record.id ||
    typeof record.revision !== 'number' ||
    !Number.isInteger(record.revision) ||
    record.revision < 1 ||
    typeof record.savedAt !== 'number' ||
    typeof record.createdAt !== 'number' ||
    typeof record.updatedAt !== 'number' ||
    typeof record.updatedBy !== 'string' ||
    !incident ||
    incident.id !== record.id
  ) {
    return null;
  }

  return {
    id: record.id,
    revision: record.revision,
    incident,
    savedAt: record.savedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    updatedBy: record.updatedBy,
  };
}

function parseLibrary(
  raw: string
): StoredSavedTTLibrary | null {
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
      !Array.isArray(parsed.records) ||
      parsed.records.length > MAX_SAVED_TT ||
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

    const records =
      parsed.records.map(
        parseStoredRecord
      );

    if (
      records.some(
        (record) => record === null
      )
    ) {
      return null;
    }

    return {
      version: 1,
      revision: parsed.revision,
      records:
        records as StoredSavedTT[],
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
  library: StoredSavedTTLibrary;
}> {
  const row = await db
    .prepare(
      `SELECT value, updated_at
       FROM sync_metadata
       WHERE key = ?
       LIMIT 1`
    )
    .bind(metadataKey(uid))
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
      'INVALID_SAVED_TT_LIBRARY',
      'Stored Saved TT library is invalid.'
    );
  }

  return {
    row,
    library,
  };
}

function sortedRecords(
  records: StoredSavedTT[]
): StoredSavedTT[] {
  return [...records].sort(
    (left, right) =>
      right.updatedAt - left.updatedAt
  );
}

function displayName(
  incident: IncidentRecord
): string {
  const report = incident.report;

  return (
    report.ticket.trim() ||
    report.summary.trim() ||
    report.region.trim() ||
    'Untitled TT'
  );
}

function recordSummary(
  record: StoredSavedTT
) {
  const report = record.incident.report;

  return {
    id: record.id,
    name: displayName(record.incident),
    revision: record.revision,
    savedAt: record.savedAt,
    updatedAt: record.updatedAt,
    status: record.incident.status,
    region: report.region,
    ticket: report.ticket,
    summary: report.summary,
    pic: report.pic,
    progressCount: report.progress.length,
  };
}

function libraryEnvelope(
  library: StoredSavedTTLibrary
) {
  return {
    records:
      sortedRecords(library.records).map(
        recordSummary
      ),
    libraryRevision: library.revision,
    updatedAt: library.updatedAt,
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
  library: StoredSavedTTLibrary;
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

    if (result.meta?.changes !== 1) {
      throw new ApiError(
        409,
        'REVISION_CONFLICT',
        'Saved TT library changed while saving.'
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
    .bind(key, value, updatedAt)
    .run();

  if (result.meta?.changes !== 1) {
    throw new ApiError(
      409,
      'REVISION_CONFLICT',
      'Saved TT library was created in another session.'
    );
  }
}

export async function GET(
  request: Request
) {
  const id = requestId();

  try {
    const principal =
      await requireFirebasePrincipal(request);

    const loaded =
      await loadLibrary(
        reportOsDb(),
        principal.uid
      );

    const incidentId =
      new URL(request.url)
        .searchParams.get('id');

    if (!incidentId) {
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

    const saved =
      loaded.library.records.find(
        (record) =>
          record.id === incidentId
      );

    if (!saved) {
      throw new ApiError(
        404,
        'SAVED_TT_NOT_FOUND',
        'Saved TT was not found.'
      );
    }

    return NextResponse.json(
      {
        ok: true,
        requestId: id,
        ...libraryEnvelope(
          loaded.library
        ),
        incident: saved.incident,
        recordMeta: recordSummary(saved),
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          'X-Request-Id': id,
        },
      }
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function PUT(
  request: Request
) {
  const id = requestId();

  try {
    const principal =
      await requireFirebasePrincipal(request);

    const body = saveSchema.safeParse(
      await request.json()
    );

    if (!body.success) {
      throw new ApiError(
        400,
        'INVALID_REQUEST',
        'Saved TT request is invalid.'
      );
    }

    const incident =
      parseIncident(body.data.incident);

    if (!incident) {
      throw new ApiError(
        400,
        'INVALID_INCIDENT',
        'Current incident cannot be stored in Saved TT.'
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
        'Saved TT library changed in another session.'
      );
    }

    const now = Date.now();
    const existing =
      loaded.library.records.find(
        (record) =>
          record.id === incident.id
      );

    const nextRecord: StoredSavedTT =
      existing
        ? {
            ...existing,
            revision: existing.revision + 1,
            incident,
            savedAt: now,
            updatedAt: now,
            updatedBy: principal.uid,
          }
        : {
            id: incident.id,
            revision: 1,
            incident,
            savedAt: now,
            createdAt: now,
            updatedAt: now,
            updatedBy: principal.uid,
          };

    const records = existing
      ? loaded.library.records.map(
          (record) =>
            record.id === existing.id
              ? nextRecord
              : record
        )
      : [
          nextRecord,
          ...loaded.library.records,
        ];

    if (records.length > MAX_SAVED_TT) {
      throw new ApiError(
        409,
        'SAVED_TT_LIMIT_REACHED',
        `Saved TT library is limited to ${MAX_SAVED_TT} records.`
      );
    }

    const nextLibrary: StoredSavedTTLibrary = {
      version: 1,
      revision: loaded.library.revision + 1,
      records: sortedRecords(records),
      updatedAt: now,
      updatedBy: principal.uid,
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
        ...libraryEnvelope(nextLibrary),
        recordMeta: recordSummary(nextRecord),
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          'X-Request-Id': id,
        },
      }
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}

export async function DELETE(
  request: Request
) {
  const id = requestId();

  try {
    const principal =
      await requireFirebasePrincipal(request);

    const body = deleteSchema.safeParse(
      await request.json()
    );

    if (!body.success) {
      throw new ApiError(
        400,
        'INVALID_REQUEST',
        'Saved TT delete request is invalid.'
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
        'Saved TT library changed in another session.'
      );
    }

    const exists =
      loaded.library.records.some(
        (record) =>
          record.id === body.data.incidentId
      );

    if (!exists) {
      throw new ApiError(
        404,
        'SAVED_TT_NOT_FOUND',
        'Saved TT to delete was not found.'
      );
    }

    const now = Date.now();
    const nextLibrary: StoredSavedTTLibrary = {
      version: 1,
      revision: loaded.library.revision + 1,
      records:
        loaded.library.records.filter(
          (record) =>
            record.id !== body.data.incidentId
        ),
      updatedAt: now,
      updatedBy: principal.uid,
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
        ...libraryEnvelope(nextLibrary),
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          'X-Request-Id': id,
        },
      }
    );
  } catch (error) {
    return errorResponse(error, id);
  }
}
