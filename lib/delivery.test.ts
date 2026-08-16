import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  SAMPLE_REPORT,
} from './report';

import {
  createDefaultClosureChecklist,
} from './closure';

import {
  buildClosedEmailDraft,
  buildDeliveryValidation,
  formatFinalClosurePackage,
  formatWagDelivery,
} from './delivery';

const COMPLETE_CHECKLIST = {
  statementUpWag: true,
  matoaClearance: {
    statusTt: true,
    eventAndPhoto: true,
    rfo: true,
  },
  sentClosedEmail: true,
};

describe('report delivery', () => {
  it('blocks finalization while closure administration is incomplete', () => {
    const validation =
      buildDeliveryValidation(
        SAMPLE_REPORT,
        createDefaultClosureChecklist()
      );

    expect(
      validation.operationalStatus
    ).toBe('restored');

    expect(
      validation.canPrepareClosedEmail
    ).toBe(true);

    expect(
      validation.canFinalize
    ).toBe(false);

    expect(
      validation.closureRemaining
    ).toBe(5);
  });

  it('allows finalization after restoration, complete report, and complete checklist', () => {
    const validation =
      buildDeliveryValidation(
        SAMPLE_REPORT,
        COMPLETE_CHECKLIST
      );

    expect(
      validation.reportScore
    ).toBe(100);

    expect(
      validation.closureScore
    ).toBe(100);

    expect(
      validation.canFinalize
    ).toBe(true);

    expect(
      validation.blockers
    ).toHaveLength(0);
  });

  it('preserves structured Impact Link and CP blocks in WAG delivery', () => {
    const report = {
      ...SAMPLE_REPORT,
      region:
        'FLP_3rd_MANDAU',
      statusTag:
        '[Open - Major]',
      primaryMarker:
        'up' as const,
      summary:
        '[Open - Major] DOWN - MAIN_A<>MAIN_B',
      ticket:
        'DATACOM-INC-20260816-00000001',
      impactLinks: [
        {
          id: 'impact-1',
          marker:
            'up' as const,
          region:
            'FLP_3rd_MANDAU',
          statusTag:
            '[Open - Major]',
          summary:
            'DOWN - CHILD_A<>CHILD_B',
          ticket:
            'DATACOM-INC-20260816-00000002',
        },
      ],
      cutPoints: [
        {
          id: 'cp-1',
          label: 'CP1',
          rootcause:
            'Drainage Project',
          cutPoint:
            'KM 7,9',
          marker:
            'up' as const,
        },
      ],
    };

    const output =
      formatWagDelivery(
        report
      );

    expect(output).toContain(
      'Impact Link :'
    );

    expect(output).toContain(
      'DATACOM-INC-20260816-00000002'
    );

    expect(output).toContain(
      'CP1 Drainage Project'
    );

    expect(output).toContain(
      'CP1 KM 7,9✅'
    );
  });

  it('builds a closed email containing incident, impact, CP, and restoration context', () => {
    const report = {
      ...SAMPLE_REPORT,
      impactLinks: [
        {
          id: 'impact-1',
          marker:
            'up' as const,
          region:
            'FLP_3rd_MANDAU',
          statusTag:
            '[Open - Major]',
          summary:
            'DOWN - CHILD_A<>CHILD_B',
          ticket:
            'DATACOM-INC-20260816-00000002',
        },
      ],
      cutPoints: [
        {
          id: 'cp-1',
          label: 'CP1',
          rootcause:
            'Drainage Project',
          cutPoint:
            'KM 7,9',
          marker:
            'up' as const,
        },
      ],
    };

    const draft =
      buildClosedEmailDraft(
        report
      );

    expect(
      draft.subject
    ).toContain(
      SAMPLE_REPORT.ticket
    );

    expect(
      draft.body
    ).toContain(
      'DATACOM-INC-20260816-00000002'
    );

    expect(
      draft.body
    ).toContain(
      'CP1 Drainage Project'
    );

    expect(
      draft.body
    ).toContain(
      '22:01 Link already up.'
    );
  });

  it('includes closure audit state in the final package', () => {
    const output =
      formatFinalClosurePackage(
        SAMPLE_REPORT,
        COMPLETE_CHECKLIST
      );

    expect(output).toContain(
      'Closure Administration'
    );

    expect(output).toContain(
      '✅ Statement Up WAG'
    );

    expect(output).toContain(
      'Closure Readiness = 100%'
    );
  });

  it('blocks delivery close while an explicit impact link remains down', () => {
    const report = {
      ...SAMPLE_REPORT,
      impactLinks: [
        {
          id: 'impact-1',
          marker:
            'down' as const,
          region:
            'FLP_3rd_MANDAU',
          statusTag:
            '[Open - Major]',
          summary:
            'DOWN - CHILD_A<>CHILD_B',
          ticket:
            'DATACOM-INC-20260816-00000002',
        },
      ],
    };

    const validation =
      buildDeliveryValidation(
        report,
        COMPLETE_CHECKLIST
      );

    expect(
      validation.operationalStatus
    ).not.toBe('restored');

    expect(
      validation.canPrepareClosedEmail
    ).toBe(false);

    expect(
      validation.canFinalize
    ).toBe(false);
  });
});
