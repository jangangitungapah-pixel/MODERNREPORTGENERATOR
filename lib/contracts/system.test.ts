import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  systemHealthSchema,
} from './system';

describe(
  'system health contract',
  () => {
    it(
      'accepts the ReportOS full-stack health envelope',
      () => {
        expect(
          systemHealthSchema.parse({
            ok: true,
            service:
              'reportos',
            runtime:
              'cloudflare-workers',
            architecture:
              'full-stack',
            databasePhase:
              'foundation',
            timestamp:
              '2026-08-16T10:00:00.000Z',
            requestId:
              'health-test',
          })
        ).toEqual({
          ok: true,
          service:
            'reportos',
          runtime:
            'cloudflare-workers',
          architecture:
            'full-stack',
          databasePhase:
            'foundation',
          timestamp:
            '2026-08-16T10:00:00.000Z',
          requestId:
            'health-test',
        });
      }
    );
  }
);
