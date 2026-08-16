import {
  NextResponse,
} from 'next/server';

import {
  systemHealthSchema,
} from '@/lib/contracts/system';

export const dynamic =
  'force-dynamic';

export async function GET() {
  const payload =
    systemHealthSchema.parse({
      ok: true,
      service: 'reportos',
      runtime:
        'cloudflare-workers',
      architecture:
        'full-stack',
      databasePhase:
        'foundation',
      timestamp:
        new Date().toISOString(),
      requestId:
        crypto.randomUUID(),
    });

  return NextResponse.json(
    payload,
    {
      headers: {
        'Cache-Control':
          'no-store',
      },
    }
  );
}
