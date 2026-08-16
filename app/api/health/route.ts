import {
  NextResponse,
} from 'next/server';

import {
  systemHealthSchema,
} from '@/lib/contracts/system';

import {
  reportOsDb,
} from '@/lib/server/db/d1';

export const dynamic =
  'force-dynamic';

async function databaseBindingReady(): Promise<boolean> {
  try {
    const value =
      await reportOsDb()
        .prepare(
          'SELECT 1 AS ready'
        )
        .first<{
          ready: number;
        }>();

    return value?.ready === 1;
  } catch {
    return false;
  }
}

export async function GET() {
  const requestId =
    crypto.randomUUID();

  const databaseReady =
    await databaseBindingReady();

  const payload =
    systemHealthSchema.parse({
      ok: true,
      ready:
        databaseReady,
      service: 'reportos',
      runtime:
        'cloudflare-workers',
      architecture:
        'full-stack',
      database: {
        binding:
          databaseReady
            ? 'ready'
            : 'standby',
        canonicalModel:
          'ready',
      },
      timestamp:
        new Date().toISOString(),
      requestId,
    });

  return NextResponse.json(
    payload,
    {
      headers: {
        'Cache-Control':
          'no-store',
        'X-Request-Id':
          requestId,
      },
    }
  );
}
