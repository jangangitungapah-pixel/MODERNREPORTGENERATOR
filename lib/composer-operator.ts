import {
  completionScore,
  duplicateProgressTimes,
  type IncidentReport,
} from './report';

import {
  closureChecklistComplete,
  closureChecklistScore,
  type ClosureChecklist,
} from './closure';

export type ComposerSectionId =
  | 'ingest'
  | 'identity'
  | 'dispatch'
  | 'progress'
  | 'closure'
  | 'preview';

export type ComposerReadinessSeverity =
  | 'blocker'
  | 'advisory';

export type ComposerReadinessIssue = {
  id: string;
  label: string;
  detail: string;
  section: ComposerSectionId;
  severity: ComposerReadinessSeverity;
};

export type ComposerReadiness = {
  reportScore: number;
  closureScore: number;
  blockers: ComposerReadinessIssue[];
  advisories: ComposerReadinessIssue[];
  readyForHandover: boolean;
};

function hasText(
  value: string | undefined
): boolean {
  return Boolean(
    value?.trim()
  );
}

export function buildComposerReadiness(
  report: IncidentReport,
  checklist?: ClosureChecklist
): ComposerReadiness {
  const issues: ComposerReadinessIssue[] = [];

  const requireField = ({
    id,
    value,
    label,
    detail,
    section,
    severity = 'blocker',
  }: {
    id: string;
    value: string | undefined;
    label: string;
    detail: string;
    section: ComposerSectionId;
    severity?: ComposerReadinessSeverity;
  }) => {
    if (!hasText(value)) {
      issues.push({
        id,
        label,
        detail,
        section,
        severity,
      });
    }
  };

  requireField({
    id: 'region',
    value: report.region,
    label: 'Region is missing',
    detail: 'Set the NOC region or operational domain for this incident.',
    section: 'identity',
  });

  requireField({
    id: 'ticket',
    value: report.ticket,
    label: 'Trouble ticket is missing',
    detail: 'Add the canonical incident or trouble-ticket identifier.',
    section: 'identity',
  });

  requireField({
    id: 'summary',
    value: report.summary,
    label: 'Incident headline is missing',
    detail: 'Add a concise alarm, link, or incident summary.',
    section: 'identity',
  });

  requireField({
    id: 'occur-time',
    value: report.occurTime,
    label: 'Occur time is missing',
    detail: 'The incident timeline needs a reliable occurrence timestamp.',
    section: 'dispatch',
  });

  requireField({
    id: 'dispatch-time',
    value: report.dispatchTime,
    label: 'Dispatch time is missing',
    detail: 'Record when the field or support response was dispatched.',
    section: 'dispatch',
  });

  requireField({
    id: 'pic',
    value: report.pic,
    label: 'PIC is not assigned',
    detail: 'Assign the current person or team responsible for follow-up.',
    section: 'dispatch',
    severity: 'advisory',
  });

  if (report.progress.length === 0) {
    issues.push({
      id: 'progress-empty',
      label: 'No progress update yet',
      detail: 'Add at least one chronological operational update.',
      section: 'progress',
      severity: 'blocker',
    });
  }

  requireField({
    id: 'rootcause',
    value: report.rootcause,
    label: 'Root cause is still empty',
    detail: 'Add the latest known root cause before final handover.',
    section: 'dispatch',
    severity: 'advisory',
  });

  requireField({
    id: 'cut-point',
    value: report.cutPoint,
    label: 'Cut point is still empty',
    detail: 'Record the cut point, landmark, or physical fault location.',
    section: 'dispatch',
    severity: 'advisory',
  });

  if (
    !report.primaryMarker ||
    report.primaryMarker === 'unknown'
  ) {
    issues.push({
      id: 'primary-marker',
      label: 'Primary link state is unknown',
      detail: 'Set the main incident marker to down, warning, or up when known.',
      section: 'dispatch',
      severity: 'advisory',
    });
  }

  const duplicateTimes =
    duplicateProgressTimes(
      report.progress
    );

  if (duplicateTimes.length > 0) {
    issues.push({
      id: 'duplicate-progress-time',
      label: 'Duplicate progress timestamps',
      detail:
        'Review duplicate time entries: ' +
        duplicateTimes.join(', ') +
        '.',
      section: 'progress',
      severity: 'advisory',
    });
  }

  const resolvedClosureScore =
    checklist
      ? closureChecklistScore(
          checklist
        )
      : 0;

  if (
    checklist &&
    !closureChecklistComplete(
      checklist
    )
  ) {
    issues.push({
      id: 'closure-incomplete',
      label: 'Closure checklist is incomplete',
      detail:
        `Closure readiness is ${resolvedClosureScore}%. Complete the remaining administrative tasks before final closure.`,
      section: 'closure',
      severity: 'advisory',
    });
  }

  const blockers =
    issues.filter(
      (issue) =>
        issue.severity ===
        'blocker'
    );

  const advisories =
    issues.filter(
      (issue) =>
        issue.severity ===
        'advisory'
    );

  return {
    reportScore:
      completionScore(report),
    closureScore:
      resolvedClosureScore,
    blockers,
    advisories,
    readyForHandover:
      blockers.length === 0,
  };
}

export function cleanComposerTemplateReport(
  report: IncidentReport
): IncidentReport {
  return {
    ...report,
    ticket: '',
    occurTime: '',
    dispatchTime: '',
    pic: '',
    progress: [],
    impactLinks:
      report.impactLinks?.map(
        (impact) => ({
          ...impact,
          ticket: '',
        })
      ) ?? [],
    cutPoints:
      report.cutPoints?.map(
        (cutPoint) => ({
          ...cutPoint,
        })
      ) ?? [],
  };
}

export function cloneComposerReport(
  report: IncidentReport
): IncidentReport {
  return {
    ...report,
    progress:
      report.progress.map(
        (entry) => ({
          ...entry,
        })
      ),
    impactLinks:
      report.impactLinks?.map(
        (impact) => ({
          ...impact,
        })
      ) ?? [],
    cutPoints:
      report.cutPoints?.map(
        (cutPoint) => ({
          ...cutPoint,
        })
      ) ?? [],
  };
}

export function defaultComposerTemplateName(
  report: IncidentReport
): string {
  const region =
    report.region.trim();
  const ticket =
    report.ticket.trim();
  const summary =
    report.summary
      .replace(/\s+/g, ' ')
      .trim();

  if (region && ticket) {
    return `${region} · ${ticket}`;
  }

  if (region && summary) {
    return `${region} · ${summary.slice(0, 72)}`;
  }

  if (summary) {
    return summary.slice(0, 90);
  }

  if (region) {
    return `${region} incident template`;
  }

  return 'Incident template';
}
