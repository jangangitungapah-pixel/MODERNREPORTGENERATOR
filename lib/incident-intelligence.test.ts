import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  createDefaultClosureChecklist,
} from './closure';

import {
  EMPTY_REPORT,
} from './report';

import {
  analyzeIncident,
  whatIsPending,
} from './incident-intelligence';

describe(
  'incident intelligence',
  () => {
    it(
      'detects timestamp and restoration contradictions',
      () => {
        const findings =
          analyzeIncident({
            report: {
              ...EMPTY_REPORT,
              ticket:
                'INC-1',
              pic: 'Team A',
              rootcause:
                'Cable cut',
              cutPoint:
                'KM 10',
              occurTime:
                '16/08/2026 10:00',
              dispatchTime:
                '16/08/2026 09:50',
              primaryMarker:
                'down',
              progress: [
                {
                  id: 'p1',
                  date:
                    '16/08/2026',
                  time:
                    '10:20',
                  text:
                    'Link already up',
                },
              ],
            },
            closureChecklist:
              createDefaultClosureChecklist(),
          });

        expect(
          findings.map(
            (finding) =>
              finding.id
          )
        ).toEqual(
          expect.arrayContaining([
            'dispatch-before-occur',
            'restored-marker-conflict',
            'restored-closure-pending',
          ])
        );
      }
    );

    it(
      'builds an actionable pending list',
      () => {
        const pending =
          whatIsPending({
            report:
              EMPTY_REPORT,
            closureChecklist:
              createDefaultClosureChecklist(),
          });

        expect(pending).toEqual(
          expect.arrayContaining([
            'Assign trouble ticket number',
            'Assign PIC',
            'Confirm root cause',
            'Send closed email',
          ])
        );
      }
    );
  }
);
