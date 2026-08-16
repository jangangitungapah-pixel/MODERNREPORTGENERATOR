import assert from 'node:assert/strict';

const BASE_URL = (
  process.env.REPORTOS_PRODUCTION_URL ??
  'https://reportos.reportosnoc.workers.dev'
).replace(/\/+$/, '');

async function assertRoute(path, label) {
  const response = await fetch(`${BASE_URL}${path}`, {
    redirect: 'follow',
    headers: {
      Accept: 'text/html',
    },
  });

  const text = await response.text();

  assert.equal(
    response.status,
    200,
    `${label} expected HTTP 200, got ${response.status}: ${text.slice(0, 500)}`
  );

  console.log(`[PASS] ${label} renders HTTP 200`);
}

console.log(`ReportOS production route smoke target: ${BASE_URL}`);

await assertRoute('/', 'Homepage');
await assertRoute('/backbone-impact', 'Impact Board');
await assertRoute('/sor-to-pdf', 'Fiber Lab');

console.log('REPORTOS_ROUTE_SMOKE=PASS');
