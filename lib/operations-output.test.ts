import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  SAMPLE_REPORT,
} from './report';

import {
  createIncidentRecord,
} from './workspace';

import {
  buildRfoDraft,
} from './rfo-builder';

import {
  buildShiftHandover,
} from './handover';

describe(
  'professional operational output',
  () => {
    it(
      'builds a deterministic RFO draft',
      () => {
        const rfo =
          buildRfoDraft(
            SAMPLE_REPORT
          );

        expect(rfo).toContain(
          SAMPLE_REPORT.ticket
        );
        expect(rfo).toContain(
          SAMPLE_REPORT.rootcause
        );
        expect(rfo).toContain(
          'Corrective Action:'
        );
      }
    );

    it(
      'summarizes active work for shift handover',
      () => {
        const incident =
          createIncidentRecord(
            'incident-1',
            SAMPLE_REPORT
          );

        const handover =
          buildShiftHandover([
            incident,
          ]);

        expect(handover).toContain(
          'REPORTOS SHIFT HANDOVER'
        );
        expect(handover).toContain(
          SAMPLE_REPORT.ticket
        );
        expect(handover).toContain(
          'Pending:'
        );
      }
    );
  }
);
