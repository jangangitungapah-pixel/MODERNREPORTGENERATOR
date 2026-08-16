import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  EMPTY_REPORT,
  SAMPLE_REPORT,
} from './report';

import {
  createIncidentRecord,
} from './workspace';

import {
  buildIncidentOperationalView,
  deriveOperationalStatus,
  formatOperationalDuration,
  parseReportDateTime,
  workspaceOperationalSummary,
} from './operations';

describe('operational intelligence', () => {
  it('parses the report date format safely', () => {
    const parsed =
      parseReportDateTime(
        '15/08/2026 13:54'
      );

    expect(parsed).not.toBeNull();

    expect(
      parseReportDateTime(
        '31/02/2026 13:54'
      )
    ).toBeNull();

    expect(
      parseReportDateTime(
        'not-a-date'
      )
    ).toBeNull();
  });

  it('derives the highest operational stage from progress history', () => {
    expect(
      deriveOperationalStatus(
        EMPTY_REPORT
      )
    ).toBe('new');

    expect(
      deriveOperationalStatus({
        ...EMPTY_REPORT,
        progress: [
          {
            id: '1',
            time: '14:00',
            text:
              'Team OTW ETA 30 min',
          },
        ],
      })
    ).toBe('dispatched');

    expect(
      deriveOperationalStatus({
        ...EMPTY_REPORT,
        progress: [
          {
            id: '1',
            time: '14:00',
            text:
              'Team OTW ETA 30 min',
          },
          {
            id: '2',
            time: '15:00',
            text:
              'Progress closure splicing cable',
          },
        ],
      })
    ).toBe('repair');

    expect(
      deriveOperationalStatus(
        SAMPLE_REPORT
      )
    ).toBe('restored');
  });

  it('freezes restored incident age at its latest progress', () => {
    const incident =
      createIncidentRecord(
        'sample',
        SAMPLE_REPORT
      );

    const now =
      new Date(
        2026,
        7,
        16,
        13,
        0
      ).getTime();

    const view =
      buildIncidentOperationalView(
        incident,
        now
      );

    expect(
      view.status
    ).toBe('restored');

    expect(
      view.ageMinutes
    ).toBe(487);

    expect(
      view.needsAttention
    ).toBe(false);
  });

  it('raises attention after sixty minutes without a running update', () => {
    const report = {
      ...EMPTY_REPORT,
      occurTime:
        '16/08/2026 09:00',
      progress: [
        {
          id: '1',
          time: '09:30',
          text:
            'Team OTW ETA 60 min',
        },
      ],
    };

    const incident =
      createIncidentRecord(
        'running',
        report
      );

    const now =
      new Date(
        2026,
        7,
        16,
        11,
        45
      ).getTime();

    const view =
      buildIncidentOperationalView(
        incident,
        now
      );

    expect(
      view.status
    ).toBe('dispatched');

    expect(
      view.staleMinutes
    ).toBe(135);

    expect(
      view.needsAttention
    ).toBe(true);

    expect(
      view.criticalAttention
    ).toBe(true);
  });

  it('summarizes active running and restored incidents', () => {
    const running =
      buildIncidentOperationalView(
        createIncidentRecord(
          'running',
          {
            ...EMPTY_REPORT,
            occurTime:
              '16/08/2026 09:00',
          }
        ),
        new Date(
          2026,
          7,
          16,
          10,
          0
        ).getTime()
      );

    const restored =
      buildIncidentOperationalView(
        createIncidentRecord(
          'restored',
          SAMPLE_REPORT
        ),
        new Date(
          2026,
          7,
          16,
          10,
          0
        ).getTime()
      );

    const summary =
      workspaceOperationalSummary([
        running,
        restored,
      ]);

    expect(
      summary.totalActive
    ).toBe(2);

    expect(
      summary.running
    ).toBe(1);

    expect(
      summary.restored
    ).toBe(1);
  });

  it('formats compact operational duration labels', () => {
    expect(
      formatOperationalDuration(
        45
      )
    ).toBe('45m');

    expect(
      formatOperationalDuration(
        90
      )
    ).toBe('1h 30m');

    expect(
      formatOperationalDuration(
        2880
      )
    ).toBe('2d');

    expect(
      formatOperationalDuration(
        null
      )
    ).toBe('—');
  });

  it('flags restored incidents whose administrative closure is incomplete', () => {
    const incident =
      createIncidentRecord(
        'restored-open-admin',
        SAMPLE_REPORT
      );

    const view =
      buildIncidentOperationalView(
        incident,
        new Date(
          2026,
          7,
          16,
          13,
          0
        ).getTime()
      );

    expect(
      view.status
    ).toBe('restored');

    expect(
      view.closureScore
    ).toBe(0);

    expect(
      view.closurePending
    ).toBe(true);
  });

  it('clears closure pending when all administrative tasks are complete', () => {
    const incident =
      createIncidentRecord(
        'restored-closed-admin',
        SAMPLE_REPORT
      );

    incident.closureChecklist = {
      statementUpWag: true,
      matoaClearance: {
        statusTt: true,
        eventAndPhoto: true,
        rfo: true,
      },
      sentClosedEmail: true,
    };

    const view =
      buildIncidentOperationalView(
        incident,
        new Date(
          2026,
          7,
          16,
          13,
          0
        ).getTime()
      );

    expect(
      view.closureScore
    ).toBe(100);

    expect(
      view.closureComplete
    ).toBe(true);

    expect(
      view.closurePending
    ).toBe(false);
  });
});
