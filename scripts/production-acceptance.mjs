import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const BASE_URL = (
  process.env.REPORTOS_PRODUCTION_URL ??
  'https://reportos.reportosnoc.workers.dev'
).replace(/\/+$/, '');

const FIREBASE_API_KEY =
  process.env.REPORTOS_FIREBASE_API_KEY ??
  'AIzaSyAXwoMQarNdVBdL4VD1XlRpn4hKZXgc43Y';

const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const incidentId = `prod-accept-${runId}`;
const ticket = `PROD-ACCEPT-${runId}`;

function pass(message) {
  console.log(`[PASS] ${message}`);
}

async function bodyFrom(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function request(path, {
  method = 'GET',
  token,
  json,
  expectedStatus = 200,
} = {}) {
  const response = await fetch(
    path.startsWith('http')
      ? path
      : `${BASE_URL}${path}`,
    {
      method,
      headers: {
        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),
        ...(json !== undefined
          ? {
              'Content-Type': 'application/json',
            }
          : {}),
      },
      body:
        json !== undefined
          ? JSON.stringify(json)
          : undefined,
      redirect: 'follow',
    }
  );

  const body = await bodyFrom(response);

  assert.equal(
    response.status,
    expectedStatus,
    `${method} ${path} expected HTTP ${expectedStatus}, got ${response.status}: ${JSON.stringify(body)}`
  );

  return body;
}

function closureChecklist(statementUpWag = false) {
  return {
    statementUpWag,
    matoaClearance: {
      statusTt: false,
      eventAndPhoto: false,
      rfo: false,
    },
    sentClosedEmail: false,
  };
}

function createWorkspace({
  summary,
  progress,
  statementUpWag = false,
}) {
  const now = new Date().toISOString();

  return {
    version: 1,
    activeIncidentId: incidentId,
    incidents: [
      {
        id: incidentId,
        status: 'active',
        createdAt: now,
        updatedAt: now,
        report: {
          region: 'PROD_ACCEPTANCE',
          summary,
          ticket,
          occurTime: '16/08/2026 20:00',
          dispatchTime: '16/08/2026 20:05',
          pic: 'ReportOS Acceptance',
          rootcause: 'Synthetic production acceptance',
          cutPoint: 'Synthetic cut point',
          progress,
          primaryMarker: 'warning',
          statusTag: '[Open - Minor]',
          impactLinks: [
            {
              id: 'impact-accept-1',
              marker: 'warning',
              region: 'PROD_ACCEPTANCE',
              statusTag: '[Open - Minor]',
              summary: 'Synthetic impact link',
              ticket: `${ticket}-IMPACT`,
            },
          ],
          cutPoints: [
            {
              id: 'cut-accept-1',
              label: 'Synthetic',
              rootcause: 'Synthetic production acceptance',
              cutPoint: 'Synthetic cut point',
              marker: 'warning',
            },
          ],
        },
        closureChecklist:
          closureChecklist(statementUpWag),
      },
    ],
  };
}

const workspaceV1 = createWorkspace({
  summary: 'Production acceptance revision 1',
  progress: [
    {
      id: 'progress-accept-1',
      date: '16/08/2026',
      time: '20:06',
      text: 'Production acceptance seed',
    },
  ],
});

const workspaceV2 = createWorkspace({
  summary: 'Production acceptance revision 2',
  progress: [
    {
      id: 'progress-accept-1',
      date: '16/08/2026',
      time: '20:06',
      text: 'Production acceptance seed',
    },
    {
      id: 'progress-accept-2',
      date: '16/08/2026',
      time: '20:07',
      text: 'Production acceptance revision update',
    },
  ],
  statementUpWag: true,
});

const staleWorkspace = createWorkspace({
  summary: 'STALE WRITE MUST NOT WIN',
  progress: [
    {
      id: 'progress-stale',
      time: '20:08',
      text: 'This stale revision must be rejected',
    },
  ],
});

const emptyWorkspace = {
  version: 1,
  activeIncidentId: '',
  incidents: [],
};

console.log(`ReportOS production acceptance target: ${BASE_URL}`);
console.log(`Synthetic ticket: ${ticket}`);

const health = await request('/api/health');
assert.equal(health?.ok, true);
assert.equal(health?.ready, true);
assert.equal(health?.service, 'reportos');
assert.equal(health?.runtime, 'cloudflare-workers');
assert.equal(health?.database?.binding, 'ready');
pass('Worker health and D1 binding are ready');

const homepageResponse = await fetch(BASE_URL, {
  redirect: 'follow',
});
const homepageText = await homepageResponse.text();
assert.equal(homepageResponse.status, 200);
assert.match(homepageText, /ReportOS/i);
pass('Production homepage renders HTTP 200');

const auth = await request(
  `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
  {
    method: 'POST',
    json: {
      returnSecureToken: true,
    },
  }
);

assert.equal(typeof auth?.idToken, 'string');
assert.equal(typeof auth?.localId, 'string');
const token = auth.idToken;
const uid = auth.localId;
pass('Firebase anonymous production identity created');

const session = await request('/api/v1/session', {
  token,
});
assert.equal(session?.ok, true);
assert.equal(session?.user?.uid, uid);
assert.equal(session?.user?.anonymous, true);
assert.equal(session?.workspace?.role, 'admin');
assert.equal(
  session?.workspace?.id,
  `workspace-${uid}`
);
pass('Authenticated session bootstraps isolated admin workspace');

const initial = await request('/api/v1/workspace', {
  token,
});
assert.equal(initial?.canonical?.revision, 0);
assert.equal(initial?.canonical?.workspace, null);
pass('Fresh acceptance workspace starts at canonical revision 0');

const savedV1 = await request('/api/v1/workspace', {
  method: 'PUT',
  token,
  json: {
    workspaceRaw: JSON.stringify(workspaceV1),
    expectedRevision: 0,
    reason: 'Production acceptance revision 1',
  },
});
assert.equal(savedV1?.canonical?.revision, 1);
assert.equal(typeof savedV1?.canonical?.checksum, 'string');
pass('Canonical workspace revision 1 written to production D1');

const listV1 = await request(
  `/api/v1/incidents?q=${encodeURIComponent(ticket)}&limit=10`,
  {
    token,
  }
);
assert.equal(listV1?.incidents?.length, 1);
assert.equal(listV1.incidents[0].ticket, ticket);
pass('Normalized incident list projection is queryable');

const detailV1 = await request(
  `/api/v1/incidents/${encodeURIComponent(incidentId)}`,
  {
    token,
  }
);
assert.equal(detailV1?.incident?.ticket, ticket);
assert.equal(detailV1?.incident?.summary, 'Production acceptance revision 1');
assert.equal(detailV1?.incident?.progress?.length, 1);
assert.equal(detailV1?.incident?.impactLinks?.length, 1);
assert.equal(detailV1?.incident?.cutPoints?.length, 1);
assert.equal(detailV1?.incident?.closure?.statementUpWag, false);
pass('Normalized detail, timeline, impact, cut point, and closure projections are valid');

const savedV2 = await request('/api/v1/workspace', {
  method: 'PUT',
  token,
  json: {
    workspaceRaw: JSON.stringify(workspaceV2),
    expectedRevision: 1,
    reason: 'Production acceptance revision 2',
  },
});
assert.equal(savedV2?.canonical?.revision, 2);
pass('Canonical revision increments under optimistic concurrency');

const detailV2 = await request(
  `/api/v1/incidents/${encodeURIComponent(incidentId)}`,
  {
    token,
  }
);
assert.equal(detailV2?.incident?.summary, 'Production acceptance revision 2');
assert.equal(detailV2?.incident?.progress?.length, 2);
assert.equal(detailV2?.incident?.closure?.statementUpWag, true);
pass('Normalized projection refreshes after canonical revision change');

const conflict = await request('/api/v1/workspace', {
  method: 'PUT',
  token,
  expectedStatus: 409,
  json: {
    workspaceRaw: JSON.stringify(staleWorkspace),
    expectedRevision: 1,
    reason: 'Production acceptance stale write',
  },
});
assert.equal(conflict?.error?.code, 'REVISION_CONFLICT');
pass('Stale canonical write is rejected with REVISION_CONFLICT');

const recoveryBeforeRestore = await request('/api/v1/recovery', {
  token,
});
assert.ok(
  Array.isArray(recoveryBeforeRestore?.snapshots) &&
    recoveryBeforeRestore.snapshots.length >= 1
);

const revisionOneSnapshot =
  recoveryBeforeRestore.snapshots.find(
    (snapshot) =>
      snapshot.reason === 'Production acceptance revision 2'
  );

assert.ok(
  revisionOneSnapshot?.id,
  'Expected recovery snapshot for revision 1 was not found'
);
pass('Recovery snapshot is created before revision mutation');

const restored = await request('/api/v1/recovery', {
  method: 'POST',
  token,
  json: {
    snapshotId: revisionOneSnapshot.id,
  },
});
assert.equal(restored?.canonical?.revision, 3);
assert.equal(
  restored?.canonical?.workspace?.incidents?.[0]?.report?.summary,
  'Production acceptance revision 1'
);
pass('Recovery restore creates a new canonical revision');

const detailRestored = await request(
  `/api/v1/incidents/${encodeURIComponent(incidentId)}`,
  {
    token,
  }
);
assert.equal(
  detailRestored?.incident?.summary,
  'Production acceptance revision 1'
);
assert.equal(detailRestored?.incident?.progress?.length, 1);
pass('Normalized projection matches restored canonical snapshot');

const auditBeforeDelete = await request('/api/v1/audit', {
  token,
});
assert.ok(
  Array.isArray(auditBeforeDelete?.events) &&
    auditBeforeDelete.events.length >= 3
);
assert.ok(
  auditBeforeDelete.events.some(
    (event) => event.action === 'workspace.created'
  )
);
assert.ok(
  auditBeforeDelete.events.some(
    (event) => event.action === 'workspace.saved'
  )
);
pass('Production audit trail records canonical mutations');

const deleted = await request('/api/v1/workspace', {
  method: 'PUT',
  token,
  json: {
    workspaceRaw: JSON.stringify(emptyWorkspace),
    expectedRevision: 3,
    reason: 'Production acceptance soft delete',
  },
});
assert.equal(deleted?.canonical?.revision, 4);
assert.equal(deleted?.canonical?.workspace?.incidents?.length, 0);
pass('Canonical workspace removes synthetic incident at revision 4');

const listAfterDelete = await request(
  `/api/v1/incidents?q=${encodeURIComponent(ticket)}&limit=10`,
  {
    token,
  }
);
assert.equal(listAfterDelete?.incidents?.length, 0);
pass('Soft-deleted incident is excluded from active normalized list');

const detailAfterDelete = await request(
  `/api/v1/incidents/${encodeURIComponent(incidentId)}`,
  {
    token,
    expectedStatus: 404,
  }
);
assert.equal(detailAfterDelete?.error?.code, 'INCIDENT_NOT_FOUND');
pass('Soft-deleted incident is excluded from normalized detail API');

const finalWorkspace = await request('/api/v1/workspace', {
  token,
});
assert.equal(finalWorkspace?.canonical?.revision, 4);
assert.equal(finalWorkspace?.canonical?.workspace?.incidents?.length, 0);
pass('Acceptance workspace finishes with no active synthetic incidents');

const finalRecovery = await request('/api/v1/recovery', {
  token,
});
assert.ok(
  finalRecovery?.snapshots?.some(
    (snapshot) =>
      snapshot.reason === 'Production acceptance soft delete'
  )
);
pass('Pre-delete canonical state remains recoverable');

console.log('');
console.log('REPORTOS_PRODUCTION_ACCEPTANCE=PASS');
console.log(`REPORTOS_ACCEPTANCE_UID=${uid}`);
console.log(`REPORTOS_ACCEPTANCE_TICKET=${ticket}`);
