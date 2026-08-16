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
  buildComposerReadiness,
  cleanComposerTemplateReport,
  defaultComposerTemplateName,
} from './composer-operator';

import {
  createDefaultClosureChecklist,
} from './closure';

describe('composer operator helpers', () => {
  it('surfaces blocking gaps for an empty report', () => {
    const readiness =
      buildComposerReadiness(
        EMPTY_REPORT,
        createDefaultClosureChecklist()
      );

    expect(
      readiness.readyForHandover
    ).toBe(false);

    expect(
      readiness.blockers.map(
        (issue) => issue.id
      )
    ).toEqual(
      expect.arrayContaining([
        'region',
        'ticket',
        'summary',
        'occur-time',
        'dispatch-time',
        'progress-empty',
      ])
    );
  });

  it('cleans volatile incident fields for reusable templates', () => {
    const cleaned =
      cleanComposerTemplateReport(
        SAMPLE_REPORT
      );

    expect(cleaned.region).toBe(
      SAMPLE_REPORT.region
    );
    expect(cleaned.ticket).toBe('');
    expect(cleaned.occurTime).toBe('');
    expect(cleaned.dispatchTime).toBe('');
    expect(cleaned.pic).toBe('');
    expect(cleaned.progress).toEqual([]);
  });

  it('builds a useful default template name', () => {
    expect(
      defaultComposerTemplateName(
        SAMPLE_REPORT
      )
    ).toContain(
      SAMPLE_REPORT.region
    );
  });
});
