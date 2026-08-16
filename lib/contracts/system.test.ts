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
      'accepts a live ReportOS runtime whose database is ready',
      () => {
        expect(
          systemHealthSchema.parse({
            ok: true,
            ready: true,
            service:
              'reportos',
            runtime:
              'cloudflare-workers',
            architecture:
              'full-stack',
            database: {
              binding:
                'ready',
              canonicalModel:
                'ready',
            },
            timestamp:
              '2026-08-16T10:00:00.000Z',
            requestId:
              'health-test',
          })
        ).toEqual({
          ok: true,
          ready: true,
          service:
            'reportos',
          runtime:
            'cloudflare-workers',
          architecture:
            'full-stack',
          database: {
            binding:
              'ready',
            canonicalModel:
              'ready',
          },
          timestamp:
            '2026-08-16T10:00:00.000Z',
          requestId:
            'health-test',
        });
      }
    );

    it(
      'distinguishes app liveness from an unbound database',
      () => {
        expect(
          systemHealthSchema.parse({
            ok: true,
            ready: false,
            service:
              'reportos',
            runtime:
              'cloudflare-workers',
            architecture:
              'full-stack',
            database: {
              binding:
                'standby',
              canonicalModel:
                'ready',
            },
            timestamp:
              '2026-08-16T10:00:00.000Z',
            requestId:
              'health-test',
          }).ready
        ).toBe(false);
      }
    );
  }
);
