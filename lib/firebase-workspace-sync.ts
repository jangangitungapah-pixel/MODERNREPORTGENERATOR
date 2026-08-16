import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';

import {
  firestoreDb,
} from './firebase-client';

import {
  deserializeWorkspace,
  serializeWorkspace,
  type IncidentRecord,
  type WorkspaceSnapshot,
} from './workspace';

const MAX_SNAPSHOT_BYTES =
  700_000;

export type CloudSnapshotSummary = {
  id: string;
  incidentId: string;
  ticket: string;
  region: string;
  summary: string;
  reason: string;
  progressCount: number;
  clientCreatedAt: number;
};

export type CloudWorkspaceBundle = {
  workspaceRaw: string | null;
  impactRaw: string | null;
  clientUpdatedAt: number | null;
};

export type CloudSyncResult = {
  snapshotCreated: boolean;
};

function clientNow(): number {
  return Date.now();
}

function snapshotId(
  incidentId: string
): string {
  const suffix =
    typeof crypto !==
      'undefined' &&
    'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random()
          .toString(36)
          .slice(2, 11);

  return (
    String(clientNow()) +
    '-' +
    incidentId.slice(0, 20) +
    '-' +
    suffix
  );
}

function incidentJson(
  incident: IncidentRecord
): string {
  return JSON.stringify(
    incident
  );
}

function incidentMeaningfulWeight(
  incident: IncidentRecord
): number {
  const report =
    incident.report;

  const textWeight = [
    report.region,
    report.summary,
    report.ticket,
    report.occurTime,
    report.dispatchTime,
    report.pic,
    report.rootcause,
    report.cutPoint,
    ...report.progress.map(
      (entry) =>
        entry.text
    ),
  ]
    .join('')
    .trim()
    .length;

  return (
    textWeight +
    report.progress.length *
      40 +
    (
      report.impactLinks?.length ??
      0
    ) *
      60 +
    (
      report.cutPoints?.length ??
      0
    ) *
      60
  );
}

function shouldCreateSafetySnapshot(
  previous: IncidentRecord,
  next: IncidentRecord
): boolean {
  const previousProgress =
    previous.report.progress.length;

  const nextProgress =
    next.report.progress.length;

  if (
    nextProgress <
    previousProgress
  ) {
    return true;
  }

  const previousWeight =
    incidentMeaningfulWeight(
      previous
    );

  const nextWeight =
    incidentMeaningfulWeight(
      next
    );

  return (
    previousWeight >= 80 &&
    nextWeight <
      previousWeight *
        0.62
  );
}

async function createIncidentSnapshot(
  uid: string,
  incident: IncidentRecord,
  reason: string
): Promise<boolean> {
  const payloadJson =
    incidentJson(
      incident
    );

  if (
    new Blob([
      payloadJson,
    ]).size >
    MAX_SNAPSHOT_BYTES
  ) {
    return false;
  }

  const ref = doc(
    firestoreDb,
    'users',
    uid,
    'snapshots',
    snapshotId(
      incident.id
    )
  );

  await setDoc(
    ref,
    {
      incidentId:
        incident.id,
      payloadJson,
      reason,
      ticket:
        incident.report.ticket,
      region:
        incident.report.region,
      summary:
        incident.report.summary,
      progressCount:
        incident.report.progress
          .length,
      clientCreatedAt:
        clientNow(),
      createdAt:
        serverTimestamp(),
    }
  );

  return true;
}

export async function loadCloudWorkspace(
  uid: string
): Promise<CloudWorkspaceBundle> {
  const workspaceRef = doc(
    firestoreDb,
    'users',
    uid,
    'workspaces',
    'default'
  );

  const workspaceDoc =
    await getDoc(
      workspaceRef
    );

  let workspaceRaw:
    string | null = null;

  let clientUpdatedAt:
    number | null = null;

  if (workspaceDoc.exists()) {
    const data =
      workspaceDoc.data();

    const incidentIds =
      Array.isArray(
        data.incidentIds
      )
        ? data.incidentIds.filter(
            (
              value
            ): value is string =>
              typeof value ===
              'string'
          )
        : [];

    const incidentDocs =
      await Promise.all(
        incidentIds.map(
          (incidentId) =>
            getDoc(
              doc(
                firestoreDb,
                'users',
                uid,
                'incidents',
                incidentId
              )
            )
        )
      );

    const incidents:
      IncidentRecord[] = [];

    for (
      const incidentDoc of
      incidentDocs
    ) {
      if (
        !incidentDoc.exists()
      ) {
        continue;
      }

      const payloadJson =
        incidentDoc.data()
          .payloadJson;

      if (
        typeof payloadJson !==
        'string'
      ) {
        continue;
      }

      try {
        const parsed =
          JSON.parse(
            payloadJson
          ) as IncidentRecord;

        incidents.push(
          parsed
        );
      } catch {
        // Ignore a corrupted incident document.
      }
    }

    const activeIncidentId =
      typeof data.activeIncidentId ===
        'string'
        ? data.activeIncidentId
        : incidents[0]?.id ??
          '';

    const candidate:
      WorkspaceSnapshot = {
      version: 1,
      activeIncidentId,
      incidents,
    };

    const validated =
      deserializeWorkspace(
        serializeWorkspace(
          candidate
        )
      );

    if (validated) {
      workspaceRaw =
        serializeWorkspace(
          validated
        );
    }

    clientUpdatedAt =
      typeof data.clientUpdatedAt ===
        'number'
        ? data.clientUpdatedAt
        : null;
  }

  const impactDoc =
    await getDoc(
      doc(
        firestoreDb,
        'users',
        uid,
        'impactBoards',
        'default'
      )
    );

  const impactRaw =
    impactDoc.exists() &&
    typeof impactDoc.data()
      .payloadJson ===
      'string'
      ? impactDoc.data()
          .payloadJson
      : null;

  return {
    workspaceRaw,
    impactRaw,
    clientUpdatedAt,
  };
}

export async function syncCloudWorkspace({
  uid,
  workspaceRaw,
  impactRaw,
  previousWorkspaceRaw,
  previousImpactRaw,
}: {
  uid: string;
  workspaceRaw: string | null;
  impactRaw: string | null;
  previousWorkspaceRaw: string | null;
  previousImpactRaw: string | null;
}): Promise<CloudSyncResult> {
  const workspace =
    deserializeWorkspace(
      workspaceRaw
    );

  if (!workspace) {
    return {
      snapshotCreated:
        false,
    };
  }

  const previous =
    deserializeWorkspace(
      previousWorkspaceRaw
    );

  const previousById =
    new Map(
      previous?.incidents.map(
        (incident) => [
          incident.id,
          incident,
        ]
      ) ?? []
    );

  let snapshotCreated =
    false;

  for (
    const incident of
    workspace.incidents
  ) {
    const previousIncident =
      previousById.get(
        incident.id
      );

    if (
      previousIncident &&
      incidentJson(
        previousIncident
      ) !==
        incidentJson(
          incident
        ) &&
      shouldCreateSafetySnapshot(
        previousIncident,
        incident
      )
    ) {
      snapshotCreated =
        (
          await createIncidentSnapshot(
            uid,
            previousIncident,
            'Automatic safety snapshot before destructive change'
          )
        ) ||
        snapshotCreated;
    }
  }

  const currentIncidentIds =
    new Set(
      workspace.incidents.map(
        (incident) =>
          incident.id
      )
    );

  const deletedIncidents =
    previous?.incidents.filter(
      (incident) =>
        !currentIncidentIds.has(
          incident.id
        )
    ) ?? [];

  for (
    const deletedIncident of
    deletedIncidents
  ) {
    snapshotCreated =
      (
        await createIncidentSnapshot(
          uid,
          deletedIncident,
          'Safety snapshot before TT deletion'
        )
      ) ||
      snapshotCreated;
  }

  const batch =
    writeBatch(
      firestoreDb
    );

  const previousJsonById =
    new Map(
      previous?.incidents.map(
        (incident) => [
          incident.id,
          incidentJson(
            incident
          ),
        ]
      ) ?? []
    );

  const now =
    clientNow();

  for (
    const incident of
    workspace.incidents
  ) {
    const payloadJson =
      incidentJson(
        incident
      );

    if (
      previousJsonById.get(
        incident.id
      ) === payloadJson
    ) {
      continue;
    }

    batch.set(
      doc(
        firestoreDb,
        'users',
        uid,
        'incidents',
        incident.id
      ),
      {
        payloadJson,
        lifecycle:
          incident.status,
        ticket:
          incident.report.ticket,
        region:
          incident.report.region,
        summary:
          incident.report.summary,
        clientUpdatedAt:
          now,
        updatedAt:
          serverTimestamp(),
      },
      {
        merge: true,
      }
    );
  }

  for (
    const deletedIncident of
    deletedIncidents
  ) {
    batch.delete(
      doc(
        firestoreDb,
        'users',
        uid,
        'incidents',
        deletedIncident.id
      )
    );
  }

  batch.set(
    doc(
      firestoreDb,
      'users',
      uid,
      'workspaces',
      'default'
    ),
    {
      schemaVersion: 1,
      activeIncidentId:
        workspace.activeIncidentId,
      incidentIds:
        workspace.incidents.map(
          (incident) =>
            incident.id
        ),
      clientUpdatedAt:
        now,
      updatedAt:
        serverTimestamp(),
    },
    {
      merge: true,
    }
  );

  if (
    impactRaw !==
    previousImpactRaw
  ) {
    batch.set(
      doc(
        firestoreDb,
        'users',
        uid,
        'impactBoards',
        'default'
      ),
      {
        payloadJson:
          impactRaw ?? '',
        clientUpdatedAt:
          now,
        updatedAt:
          serverTimestamp(),
      },
      {
        merge: true,
      }
    );
  }

  await batch.commit();

  return {
    snapshotCreated,
  };
}

export async function listCloudSnapshots(
  uid: string
): Promise<CloudSnapshotSummary[]> {
  const result =
    await getDocs(
      query(
        collection(
          firestoreDb,
          'users',
          uid,
          'snapshots'
        ),
        orderBy(
          'clientCreatedAt',
          'desc'
        ),
        limit(12)
      )
    );

  return result.docs
    .map(
      (snapshotDoc) => {
        const data =
          snapshotDoc.data();

        return {
          id:
            snapshotDoc.id,
          incidentId:
            typeof data.incidentId ===
              'string'
              ? data.incidentId
              : '',
          ticket:
            typeof data.ticket ===
              'string'
              ? data.ticket
              : '',
          region:
            typeof data.region ===
              'string'
              ? data.region
              : '',
          summary:
            typeof data.summary ===
              'string'
              ? data.summary
              : '',
          reason:
            typeof data.reason ===
              'string'
              ? data.reason
              : 'Safety snapshot',
          progressCount:
            typeof data.progressCount ===
              'number'
              ? data.progressCount
              : 0,
          clientCreatedAt:
            typeof data.clientCreatedAt ===
              'number'
              ? data.clientCreatedAt
              : 0,
        };
      }
    )
    .filter(
      (snapshot) =>
        snapshot.incidentId
    );
}

export async function restoreCloudSnapshot(
  uid: string,
  snapshotIdValue: string,
  currentWorkspaceRaw: string | null
): Promise<string | null> {
  const snapshotDoc =
    await getDoc(
      doc(
        firestoreDb,
        'users',
        uid,
        'snapshots',
        snapshotIdValue
      )
    );

  if (!snapshotDoc.exists()) {
    return null;
  }

  const payloadJson =
    snapshotDoc.data()
      .payloadJson;

  if (
    typeof payloadJson !==
    'string'
  ) {
    return null;
  }

  let incident:
    IncidentRecord;

  try {
    incident =
      JSON.parse(
        payloadJson
      ) as IncidentRecord;
  } catch {
    return null;
  }

  const validatedIncident =
    deserializeWorkspace(
      JSON.stringify({
        version: 1,
        activeIncidentId:
          incident.id,
        incidents: [
          incident,
        ],
      })
    );

  if (!validatedIncident) {
    return null;
  }

  const current =
    deserializeWorkspace(
      currentWorkspaceRaw
    );

  const restoredIncident =
    validatedIncident
      .incidents[0];

  const incidents =
    current
      ? [
          ...current.incidents.filter(
            (entry) =>
              entry.id !==
              restoredIncident.id
          ),
          restoredIncident,
        ]
      : [
          restoredIncident,
        ];

  return serializeWorkspace({
    version: 1,
    activeIncidentId:
      restoredIncident.id,
    incidents,
  });
}

export async function deleteCloudSnapshot(
  uid: string,
  snapshotIdValue: string
): Promise<void> {
  await deleteDoc(
    doc(
      firestoreDb,
      'users',
      uid,
      'snapshots',
      snapshotIdValue
    )
  );
}
