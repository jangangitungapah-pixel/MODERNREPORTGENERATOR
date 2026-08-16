import {
  EMPTY_REPORT,
  type IncidentReport,
} from './report';

export type IncidentLifecycle =
  | 'active'
  | 'archived';

export type IncidentRecord = {
  id: string;
  status: IncidentLifecycle;
  createdAt: string;
  updatedAt: string;
  report: IncidentReport;
};

export type WorkspaceSnapshot = {
  version: 1;
  activeIncidentId: string;
  incidents: IncidentRecord[];
};

function cloneReport(
  report: IncidentReport
): IncidentReport {
  return {
    ...report,
    progress: report.progress.map(
      (entry) => ({
        ...entry,
      })
    ),
  };
}

export function createIncidentRecord(
  id: string,
  report: IncidentReport =
    EMPTY_REPORT,
  now: string =
    new Date().toISOString()
): IncidentRecord {
  return {
    id,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    report:
      cloneReport(report),
  };
}

export function upsertIncidentReport(
  incidents: IncidentRecord[],
  incidentId: string,
  report: IncidentReport,
  now: string =
    new Date().toISOString()
): IncidentRecord[] {
  let found = false;

  const next =
    incidents.map(
      (incident) => {
        if (
          incident.id !==
          incidentId
        ) {
          return incident;
        }

        found = true;

        return {
          ...incident,
          updatedAt: now,
          report:
            cloneReport(report),
        };
      }
    );

  if (found) {
    return next;
  }

  return [
    createIncidentRecord(
      incidentId,
      report,
      now
    ),
    ...next,
  ];
}

export function setIncidentArchived(
  incidents: IncidentRecord[],
  incidentId: string,
  archived: boolean,
  now: string =
    new Date().toISOString()
): IncidentRecord[] {
  return incidents.map(
    (incident) =>
      incident.id === incidentId
        ? {
            ...incident,
            status: archived
              ? 'archived'
              : 'active',
            updatedAt: now,
          }
        : incident
  );
}

export function incidentSearchText(
  incident: IncidentRecord
): string {
  const report =
    incident.report;

  return [
    report.region,
    report.summary,
    report.ticket,
    report.pic,
    report.rootcause,
    report.cutPoint,
    ...report.progress.map(
      (entry) =>
        entry.time +
        ' ' +
        entry.text
    ),
  ]
    .join(' ')
    .toLowerCase();
}

export function filterIncidents(
  incidents: IncidentRecord[],
  query: string
): IncidentRecord[] {
  const normalized =
    query
      .trim()
      .toLowerCase();

  if (!normalized) {
    return incidents;
  }

  const terms =
    normalized
      .split(/\s+/)
      .filter(Boolean);

  return incidents.filter(
    (incident) => {
      const searchable =
        incidentSearchText(
          incident
        );

      return terms.every(
        (term) =>
          searchable.includes(term)
      );
    }
  );
}

export function sortIncidentsByUpdatedAt(
  incidents: IncidentRecord[]
): IncidentRecord[] {
  return [...incidents].sort(
    (left, right) =>
      Date.parse(
        right.updatedAt
      ) -
      Date.parse(
        left.updatedAt
      )
  );
}

function isString(
  value: unknown
): value is string {
  return typeof value === 'string';
}

function isProgressEntry(
  value: unknown
): boolean {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false;
  }

  const entry =
    value as Record<
      string,
      unknown
    >;

  return (
    isString(entry.id) &&
    isString(entry.time) &&
    isString(entry.text)
  );
}

function isIncidentReport(
  value: unknown
): value is IncidentReport {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false;
  }

  const report =
    value as Record<
      string,
      unknown
    >;

  return (
    isString(report.region) &&
    isString(report.summary) &&
    isString(report.ticket) &&
    isString(report.occurTime) &&
    isString(report.dispatchTime) &&
    isString(report.pic) &&
    isString(report.rootcause) &&
    isString(report.cutPoint) &&
    Array.isArray(
      report.progress
    ) &&
    report.progress.every(
      isProgressEntry
    )
  );
}

function isIncidentRecord(
  value: unknown
): value is IncidentRecord {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false;
  }

  const incident =
    value as Record<
      string,
      unknown
    >;

  return (
    isString(incident.id) &&
    (
      incident.status ===
        'active' ||
      incident.status ===
        'archived'
    ) &&
    isString(
      incident.createdAt
    ) &&
    isString(
      incident.updatedAt
    ) &&
    isIncidentReport(
      incident.report
    )
  );
}

export function serializeWorkspace(
  snapshot: WorkspaceSnapshot
): string {
  return JSON.stringify(
    snapshot
  );
}

export function deserializeWorkspace(
  raw: string | null
): WorkspaceSnapshot | null {
  if (!raw) {
    return null;
  }

  try {
    const value =
      JSON.parse(
        raw
      ) as unknown;

    if (
      typeof value !==
        'object' ||
      value === null
    ) {
      return null;
    }

    const snapshot =
      value as Record<
        string,
        unknown
      >;

    if (
      snapshot.version !== 1 ||
      !isString(
        snapshot.activeIncidentId
      ) ||
      !Array.isArray(
        snapshot.incidents
      ) ||
      !snapshot.incidents.every(
        isIncidentRecord
      )
    ) {
      return null;
    }

    if (
      snapshot.incidents.length >
        0 &&
      !snapshot.incidents.some(
        (incident) =>
          (
            incident as
              IncidentRecord
          ).id ===
          snapshot.activeIncidentId
      )
    ) {
      return null;
    }

    return {
      version: 1,
      activeIncidentId:
        snapshot.activeIncidentId,
      incidents:
        snapshot.incidents as
          IncidentRecord[],
    };
  } catch {
    return null;
  }
}
