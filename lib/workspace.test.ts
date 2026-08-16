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
  deserializeWorkspace,
  filterIncidents,
  serializeWorkspace,
  setIncidentArchived,
  setIncidentClosureChecklist,
  sortIncidentsByUpdatedAt,
  upsertIncidentReport,
  type WorkspaceSnapshot,
} from './workspace';

describe('incident workspace', () => {
  it('creates isolated incident records', () => {
    const record =
      createIncidentRecord(
        'incident-1',
        SAMPLE_REPORT,
        '2026-08-16T06:00:00.000Z'
      );

    record.report.region =
      'CHANGED';

    expect(
      SAMPLE_REPORT.region
    ).toBe('MANDAU');

    expect(
      record.status
    ).toBe('active');
  });

  it('upserts the current report without mutating other incidents', () => {
    const first =
      createIncidentRecord(
        'one',
        SAMPLE_REPORT,
        '2026-08-16T06:00:00.000Z'
      );

    const second =
      createIncidentRecord(
        'two',
        EMPTY_REPORT,
        '2026-08-16T06:01:00.000Z'
      );

    const next =
      upsertIncidentReport(
        [first, second],
        'two',
        {
          ...EMPTY_REPORT,
          ticket:
            'INC-NEW',
        },
        '2026-08-16T07:00:00.000Z'
      );

    expect(
      next.find(
        (item) =>
          item.id === 'one'
      )?.report.ticket
    ).toBe(
      SAMPLE_REPORT.ticket
    );

    expect(
      next.find(
        (item) =>
          item.id === 'two'
      )?.report.ticket
    ).toBe('INC-NEW');
  });

  it('archives and restores an incident', () => {
    const initial = [
      createIncidentRecord(
        'incident-1',
        SAMPLE_REPORT
      ),
    ];

    const archived =
      setIncidentArchived(
        initial,
        'incident-1',
        true,
        '2026-08-16T08:00:00.000Z'
      );

    expect(
      archived[0].status
    ).toBe('archived');

    const restored =
      setIncidentArchived(
        archived,
        'incident-1',
        false,
        '2026-08-16T09:00:00.000Z'
      );

    expect(
      restored[0].status
    ).toBe('active');
  });

  it('searches across ticket, region, and progress content', () => {
    const records = [
      createIncidentRecord(
        'one',
        SAMPLE_REPORT
      ),
      createIncidentRecord(
        'two',
        {
          ...EMPTY_REPORT,
          region: 'PEKANBARU',
          ticket:
            'INC-SECOND',
          progress: [
            {
              id: 'p1',
              time: '10:00',
              text:
                'Team checking attenuation',
            },
          ],
        }
      ),
    ];

    expect(
      filterIncidents(
        records,
        'MANDau 16661'
      )
    ).toHaveLength(1);

    expect(
      filterIncidents(
        records,
        'attenuation'
      )[0].id
    ).toBe('two');
  });

  it('sorts incident records by latest update', () => {
    const older =
      createIncidentRecord(
        'older',
        EMPTY_REPORT,
        '2026-08-16T06:00:00.000Z'
      );

    const newer =
      createIncidentRecord(
        'newer',
        EMPTY_REPORT,
        '2026-08-16T08:00:00.000Z'
      );

    expect(
      sortIncidentsByUpdatedAt([
        older,
        newer,
      ]).map(
        (item) => item.id
      )
    ).toEqual([
      'newer',
      'older',
    ]);
  });

  it('round-trips a valid workspace snapshot', () => {
    const incident =
      createIncidentRecord(
        'incident-1',
        SAMPLE_REPORT
      );

    const snapshot:
      WorkspaceSnapshot = {
        version: 1,
        activeIncidentId:
          incident.id,
        incidents: [
          incident,
        ],
      };

    expect(
      deserializeWorkspace(
        serializeWorkspace(
          snapshot
        )
      )
    ).toEqual(snapshot);
  });

  it('rejects malformed workspace payloads', () => {
    expect(
      deserializeWorkspace(
        '{"version":1,"activeIncidentId":"missing","incidents":[]}'
      )
    ).toEqual({
      version: 1,
      activeIncidentId:
        'missing',
      incidents: [],
    });

    expect(
      deserializeWorkspace(
        '{"version":2}'
      )
    ).toBeNull();

    expect(
      deserializeWorkspace(
        'not-json'
      )
    ).toBeNull();
  });

  it('persists closure checklist state per incident', () => {
    const first =
      createIncidentRecord(
        'first',
        SAMPLE_REPORT
      );

    const second =
      createIncidentRecord(
        'second',
        EMPTY_REPORT
      );

    const checklist = {
      ...first.closureChecklist,
      statementUpWag: true,
    };

    const next =
      setIncidentClosureChecklist(
        [first, second],
        'first',
        checklist,
        '2026-08-16T10:00:00.000Z'
      );

    expect(
      next[0].closureChecklist
        .statementUpWag
    ).toBe(true);

    expect(
      next[1].closureChecklist
        .statementUpWag
    ).toBe(false);
  });

  it('migrates legacy F3 incidents that do not have closure checklist data', () => {
    const legacy =
      JSON.stringify({
        version: 1,
        activeIncidentId:
          'legacy',
        incidents: [
          {
            id: 'legacy',
            status: 'active',
            createdAt:
              '2026-08-16T06:00:00.000Z',
            updatedAt:
              '2026-08-16T06:00:00.000Z',
            report:
              SAMPLE_REPORT,
          },
        ],
      });

    const migrated =
      deserializeWorkspace(
        legacy
      );

    expect(
      migrated?.incidents[0]
        .closureChecklist
    ).toEqual({
      statementUpWag: false,
      matoaClearance: {
        statusTt: false,
        eventAndPhoto: false,
        rfo: false,
      },
      sentClosedEmail: false,
    });
  });
});
