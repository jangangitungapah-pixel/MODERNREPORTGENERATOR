import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const FIREBASE_API_KEY =
  process.env.REPORTOS_FIREBASE_API_KEY ??
  'AIzaSyAXwoMQarNdVBdL4VD1XlRpn4hKZXgc43Y';

const FIREBASE_PROJECT_ID =
  process.env.REPORTOS_FIREBASE_PROJECT_ID ??
  'reportgeneratornoc';

const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;

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

async function request(url, {
  method = 'GET',
  token,
  json,
  expectedStatus = 200,
} = {}) {
  const response = await fetch(url, {
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
  });

  const body = await bodyFrom(response);

  assert.equal(
    response.status,
    expectedStatus,
    `${method} ${url} expected HTTP ${expectedStatus}, got ${response.status}: ${JSON.stringify(body)}`
  );

  return body;
}

const authUrl =
  `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(FIREBASE_API_KEY)}`;

const auth = await request(authUrl, {
  method: 'POST',
  json: {
    returnSecureToken: true,
  },
});

assert.equal(typeof auth?.idToken, 'string');
assert.equal(typeof auth?.localId, 'string');

const token = auth.idToken;
const uid = auth.localId;

const firestoreBase =
  `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(FIREBASE_PROJECT_ID)}/databases/(default)/documents`;

const workspaceId = `acceptance-${runId}`;
const snapshotId = `acceptance-${runId}`;

const workspaceUrl =
  `${firestoreBase}/users/${encodeURIComponent(uid)}/workspaces/${encodeURIComponent(workspaceId)}`;

const snapshotUrl =
  `${firestoreBase}/users/${encodeURIComponent(uid)}/snapshots/${encodeURIComponent(snapshotId)}`;

const foreignWorkspaceUrl =
  `${firestoreBase}/users/${encodeURIComponent(`foreign-${uid}`)}/workspaces/${encodeURIComponent(workspaceId)}`;

async function cleanup() {
  await fetch(snapshotUrl, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }).catch(() => undefined);

  await fetch(workspaceUrl, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }).catch(() => undefined);

  await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idToken: token,
      }),
    }
  ).catch(() => undefined);
}

try {
  pass('Firebase anonymous identity created for Firestore recovery acceptance');

  const ownWorkspace = await request(workspaceUrl, {
    method: 'PATCH',
    token,
    json: {
      fields: {
        marker: {
          stringValue: `reportos-${runId}`,
        },
        clientUpdatedAt: {
          integerValue: String(Date.now()),
        },
      },
    },
  });

  assert.equal(
    ownWorkspace?.fields?.marker?.stringValue,
    `reportos-${runId}`
  );
  pass('Firestore owner can create recovery workspace document');

  const ownWorkspaceRead = await request(workspaceUrl, {
    token,
  });
  assert.equal(
    ownWorkspaceRead?.fields?.marker?.stringValue,
    `reportos-${runId}`
  );
  pass('Firestore owner can read own recovery workspace document');

  await request(foreignWorkspaceUrl, {
    method: 'PATCH',
    token,
    expectedStatus: 403,
    json: {
      fields: {
        marker: {
          stringValue: 'must-be-denied',
        },
      },
    },
  });
  pass('Firestore security rules reject cross-UID writes');

  const snapshot = await request(snapshotUrl, {
    method: 'PATCH',
    token,
    json: {
      fields: {
        incidentId: {
          stringValue: `incident-${runId}`,
        },
        payloadJson: {
          stringValue: '{"acceptance":true}',
        },
        reason: {
          stringValue: 'Production Firestore acceptance snapshot',
        },
        clientCreatedAt: {
          integerValue: String(Date.now()),
        },
      },
    },
  });

  assert.equal(
    snapshot?.fields?.reason?.stringValue,
    'Production Firestore acceptance snapshot'
  );
  pass('Firestore owner can create recovery snapshot');

  await request(snapshotUrl, {
    method: 'PATCH',
    token,
    expectedStatus: 403,
    json: {
      fields: {
        reason: {
          stringValue: 'Mutation must be denied',
        },
      },
    },
  });
  pass('Firestore recovery snapshots are immutable after creation');

  const snapshotRead = await request(snapshotUrl, {
    token,
  });
  assert.equal(
    snapshotRead?.fields?.reason?.stringValue,
    'Production Firestore acceptance snapshot'
  );
  pass('Immutable recovery snapshot remains readable');

  await request(snapshotUrl, {
    method: 'DELETE',
    token,
  });
  await request(workspaceUrl, {
    method: 'DELETE',
    token,
  });
  pass('Firestore acceptance documents cleaned up through owner rules');

  await request(workspaceUrl, {
    token,
    expectedStatus: 404,
  });
  pass('Firestore cleanup confirmed');

  console.log('');
  console.log('REPORTOS_FIRESTORE_ACCEPTANCE=PASS');
} finally {
  await cleanup();
}
