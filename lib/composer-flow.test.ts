import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  createDefaultClosureChecklist,
} from './closure';

import {
  buildComposerFlow,
} from './composer-flow';

import {
  EMPTY_REPORT,
  type IncidentReport,
} from './report';

function reportWith(
  patch: Partial<IncidentReport>
): IncidentReport {
  return {
    ...EMPTY_REPORT,
    ...patch,
    progress:
      patch.progress ?? [],
    impactLinks:
      patch.impactLinks ?? [],
    cutPoints:
      patch.cutPoints ?? [],
  };
}

describe('buildComposerFlow', () => {
  it('starts an empty draft at identity', () => {
    const flow = buildComposerFlow(
      reportWith({}),
      createDefaultClosureChecklist()
    );

    expect(flow.stages[0]).toMatchObject({
      id: 'identity',
      state: 'current',
      detail: '0/3 core identifiers',
    });

    expect(flow.nextAction.id).toBe(
      'region'
    );
    expect(flow.nextAction.tone).toBe(
      'required'
    );
  });

  it('moves the guided stage forward as required work is completed', () => {
    const flow = buildComposerFlow(
      reportWith({
        region: 'MANDAU',
        ticket: 'INC-001',
        summary: 'LINK DOWN A <> B',
        occurTime: '18/08/2026 20:00',
        dispatchTime: '18/08/2026 20:15',
      }),
      createDefaultClosureChecklist()
    );

    expect(flow.stages[0].state).toBe(
      'complete'
    );
    expect(flow.stages[1].state).toBe(
      'complete'
    );
    expect(flow.stages[2].state).toBe(
      'current'
    );
    expect(flow.nextAction.id).toBe(
      'progress-empty'
    );
  });

  it('prefers advisory improvement after all blockers are clear', () => {
    const flow = buildComposerFlow(
      reportWith({
        region: 'MANDAU',
        ticket: 'INC-001',
        summary: 'LINK DOWN A <> B',
        occurTime: '18/08/2026 20:00',
        dispatchTime: '18/08/2026 20:15',
        progress: [
          {
            id: 'p1',
            date: '18/08/2026',
            time: '20:20',
            text: 'Team OTW',
          },
        ],
      }),
      createDefaultClosureChecklist()
    );

    expect(flow.blockerCount).toBe(0);
    expect(flow.nextAction.id).toBe('pic');
    expect(flow.nextAction.tone).toBe(
      'advisory'
    );
  });

  it('lands on preview when report and closure readiness are fully clear', () => {
    const checklist = {
      statementUpWag: true,
      matoaClearance: {
        statusTt: true,
        eventAndPhoto: true,
        rfo: true,
      },
      sentClosedEmail: true,
    };

    const flow = buildComposerFlow(
      reportWith({
        region: 'MANDAU',
        ticket: 'INC-001',
        summary: 'LINK DOWN A <> B',
        occurTime: '18/08/2026 20:00',
        dispatchTime: '18/08/2026 20:15',
        pic: 'Team A',
        rootcause: 'Fiber cut',
        cutPoint: 'KM 10',
        primaryMarker: 'down',
        progress: [
          {
            id: 'p1',
            date: '18/08/2026',
            time: '20:20',
            text: 'Team OTW',
          },
        ],
      }),
      checklist
    );

    expect(flow.completedStageCount).toBe(4);
    expect(flow.nextAction).toMatchObject({
      id: 'review-report',
      section: 'preview',
      tone: 'ready',
    });
  });
});
