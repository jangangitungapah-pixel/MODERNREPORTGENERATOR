import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  SAMPLE_BACKBONE_IMPACT,
  backboneImpactStats,
  formatBackboneImpact,
} from './backbone-impact';

describe('backbone impact formatter', () => {
  it('formats the operational WAG template with simple and nested impacts', () => {
    expect(
      formatBackboneImpact(
        SAMPLE_BACKBONE_IMPACT
      )
    ).toBe(
      [
        '*UJB tegal - pekalongan*',
        '',
        '1.H3I ✅',
        '',
        '2.ASIANET ⏳',
        '',
        '3.IFORTE',
        '- JVBB ❌ (RX pekalongan)',
        '- new JVBB ✅',
        '',
        '4.FIBERSTAR',
        '- UJB ✅',
        '- UAJB ✅',
        '- UAJBF ⚠️ (RX pekalongan 0.7 db)',
      ].join('\n')
    );
  });

  it('counts leaf impacts without double-counting grouped customers', () => {
    expect(
      backboneImpactStats(
        SAMPLE_BACKBONE_IMPACT
      )
    ).toEqual({
      total: 7,
      up: 4,
      pending: 1,
      down: 1,
      warning: 1,
      unknown: 0,
    });
  });

  it('falls back to parent status when a group has no valid child service', () => {
    const output =
      formatBackboneImpact({
        title: 'BACKBONE A-B',
        customers: [
          {
            id: '1',
            name: 'CUSTOMER',
            status: 'down',
            note: 'No response',
            services: [
              {
                id: 'empty',
                name: '',
                status: 'up',
                note: '',
              },
            ],
          },
        ],
      });

    expect(output).toContain(
      '1.CUSTOMER ❌ (No response)'
    );
  });
});
