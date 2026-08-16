import {
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import {
  firestoreDb,
} from './firebase-client';

import {
  deserializeWorkspace,
} from './workspace';

const MAX_SNAPSHOT_BYTES =
  700_000;

function clientNow(): number {
  return Date.now();
}

function createSnapshotId(
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

export async function snapshotActiveIncident({
  uid,
  workspaceRaw,
  reason,
}: {
  uid: string;
  workspaceRaw: string | null;
  reason: string;
}): Promise<boolean> {
  const workspace =
    deserializeWorkspace(
      workspaceRaw
    );

  if (!workspace) {
    return false;
  }

  const incident =
    workspace.incidents.find(
      (entry) =>
        entry.id ===
        workspace.activeIncidentId
    );

  if (!incident) {
    return false;
  }

  const payloadJson =
    JSON.stringify(
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

  await setDoc(
    doc(
      firestoreDb,
      'users',
      uid,
      'snapshots',
      createSnapshotId(
        incident.id
      )
    ),
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
