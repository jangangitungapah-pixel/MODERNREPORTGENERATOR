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
const templateName = `Composer acceptance ${runId}`;

async function bodyFrom(response) {
  const text = await response.text();
  if (!text) return null;
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
        ? { Authorization: `Bearer ${token}` }
        : {}),
      ...(json !== undefined
        ? { 'Content-Type': 'application/json' }
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

const auth = await request(
  `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
  {
    method: 'POST',
    json: { returnSecureToken: true },
  }
);

const token = auth.idToken;
assert.equal(typeof token, 'string');

async function cleanupAuth() {
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

const report = {
  region: 'PROD_ACCEPTANCE',
  summary: 'Reusable Composer template acceptance',
  ticket: `INC-${runId}`,
  occurTime: '17/08/2026 02:00',
  dispatchTime: '17/08/2026 02:05',
  pic: 'ReportOS Acceptance',
  rootcause: 'Synthetic reusable template',
  cutPoint: 'Synthetic cut point',
  progress: [
    {
      id: `progress-${runId}`,
      date: '17/08/2026',
      time: '02:06',
      text: 'Synthetic Composer template acceptance update',
    },
  ],
  primaryMarker: 'warning',
  statusTag: '[Open - Minor]',
  impactLinks: [],
  cutPoints: [],
};

try {
  const initial = await request(
    `${BASE_URL}/api/v1/composer-templates`,
    { token }
  );
  assert.equal(initial.libraryRevision, 0);
  assert.deepEqual(initial.templates, []);

  const saved = await request(
    `${BASE_URL}/api/v1/composer-templates`,
    {
      method: 'PUT',
      token,
      json: {
        name: templateName,
        report,
        expectedLibraryRevision: 0,
      },
    }
  );

  assert.equal(saved.libraryRevision, 1);
  assert.equal(saved.templates.length, 1);
  assert.equal(saved.templateMeta.name, templateName);

  const templateId = saved.templateMeta.id;

  const loaded = await request(
    `${BASE_URL}/api/v1/composer-templates?id=${encodeURIComponent(templateId)}`,
    { token }
  );
  assert.equal(loaded.template.ticket, report.ticket);
  assert.equal(loaded.templateMeta.name, templateName);

  const deleted = await request(
    `${BASE_URL}/api/v1/composer-templates`,
    {
      method: 'DELETE',
      token,
      json: {
        templateId,
        expectedLibraryRevision: 1,
      },
    }
  );
  assert.equal(deleted.libraryRevision, 2);
  assert.deepEqual(deleted.templates, []);

  console.log('[PASS] Composer template library create/read/delete round-trip');
  console.log('REPORTOS_COMPOSER_TEMPLATE_ACCEPTANCE=PASS');
} finally {
  await cleanupAuth();
}
