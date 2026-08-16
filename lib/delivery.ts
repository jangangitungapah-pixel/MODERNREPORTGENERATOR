import {
  completionScore,
  detectProgressKind,
  formatReport,
  type IncidentReport,
  type LinkMarker,
} from './report';

import {
  closureChecklistComplete,
  closureChecklistCompletedCount,
  closureChecklistScore,
  CLOSURE_ATOMIC_TASK_COUNT,
  matoaClearanceComplete,
  type ClosureChecklist,
} from './closure';

import {
  deriveOperationalStatus,
  type OperationalStatus,
} from './operations';

export type DeliveryValidation = {
  operationalStatus:
    OperationalStatus;
  reportScore: number;
  closureScore: number;
  closureRemaining: number;
  canCopyWag: boolean;
  canPrepareClosedEmail: boolean;
  canFinalize: boolean;
  blockers: string[];
};

export type ClosedEmailDraft = {
  subject: string;
  body: string;
};

function markerSymbol(
  marker: LinkMarker | undefined
): string {
  if (marker === 'up') {
    return '✅';
  }

  if (marker === 'down') {
    return '❌';
  }

  if (marker === 'warning') {
    return '⚠️';
  }

  return '';
}

function lastRestorationLine(
  report: IncidentReport
): string {
  for (
    let index =
      report.progress.length - 1;
    index >= 0;
    index -= 1
  ) {
    const entry =
      report.progress[index];

    if (
      detectProgressKind(
        entry.text
      ) === 'restored'
    ) {
      return (
        entry.time.trim() +
        ' ' +
        entry.text.trim()
      ).trim();
    }
  }

  return '';
}

export function buildDeliveryValidation(
  report: IncidentReport,
  checklist: ClosureChecklist
): DeliveryValidation {
  const operationalStatus =
    deriveOperationalStatus(
      report
    );

  const reportScore =
    completionScore(report);

  const closureScore =
    closureChecklistScore(
      checklist
    );

  const closureRemaining =
    CLOSURE_ATOMIC_TASK_COUNT -
    closureChecklistCompletedCount(
      checklist
    );

  const restored =
    operationalStatus ===
    'restored';

  const reportComplete =
    reportScore === 100;

  const adminComplete =
    closureChecklistComplete(
      checklist
    );

  const blockers: string[] = [];

  if (!restored) {
    blockers.push(
      'Operational status must be RESTORED before final closure.'
    );
  }

  if (!reportComplete) {
    blockers.push(
      'Report completeness is ' +
        reportScore +
        '%. Complete all required report signals first.'
    );
  }

  if (!adminComplete) {
    blockers.push(
      closureRemaining +
        ' closure task' +
        (
          closureRemaining === 1
            ? ''
            : 's'
        ) +
        ' remaining.'
    );
  }

  return {
    operationalStatus,
    reportScore,
    closureScore,
    closureRemaining,
    canCopyWag:
      report.region.trim().length >
        0 ||
      report.ticket.trim().length >
        0 ||
      report.summary.trim().length >
        0,
    canPrepareClosedEmail:
      restored &&
      reportComplete,
    canFinalize:
      restored &&
      reportComplete &&
      adminComplete,
    blockers,
  };
}

export function formatWagDelivery(
  report: IncidentReport
): string {
  //
  // Keep WAG delivery byte-for-byte aligned
  // with the current ReportOS report format,
  // including Impact Link and multi-CP blocks.
  //
  return formatReport(report);
}

export function buildClosedEmailDraft(
  report: IncidentReport
): ClosedEmailDraft {
  const impactLinks =
    report.impactLinks ??
    [];

  const cutPoints =
    report.cutPoints ??
    [];

  const restoration =
    lastRestorationLine(
      report
    );

  const subject =
    '[CLOSED] ' +
    (
      report.ticket.trim() ||
      'Incident'
    ) +
    ' | ' +
    (
      report.region.trim() ||
      'Unassigned'
    );

  const body: string[] = [
    'Dear Team,',
    '',
    'Please find the incident closure summary below.',
    '',
    'TT = ' +
      report.ticket.trim(),
    'Region = ' +
      report.region.trim(),
    'Summary = ' +
      report.summary.trim(),
    'Occur Time = ' +
      report.occurTime.trim(),
    'Dispatch Time = ' +
      report.dispatchTime.trim(),
    'PIC = ' +
      report.pic.trim(),
  ];

  if (impactLinks.length > 0) {
    body.push(
      '',
      'Impact Link :',
      ...impactLinks.map(
        (impact) =>
          (
            markerSymbol(
              impact.marker
            ) +
            ' ' +
            impact.ticket.trim() +
            ' | ' +
            impact.summary.trim()
          ).trim()
      )
    );
  }

  if (cutPoints.length > 0) {
    body.push(
      '',
      'Rootcause :',
      ...cutPoints.map(
        (entry) =>
          (
            entry.label.trim() +
            ' ' +
            entry.rootcause.trim()
          ).trim()
      ),
      '',
      'Cut Point :',
      ...cutPoints.map(
        (entry) =>
          (
            entry.label.trim() +
            ' ' +
            entry.cutPoint.trim() +
            markerSymbol(
              entry.marker
            )
          ).trim()
      )
    );
  } else {
    body.push(
      'Rootcause = ' +
        report.rootcause.trim(),
      'Cut Point = ' +
        report.cutPoint.trim()
    );
  }

  body.push(
    '',
    'Restoration Update = ' +
      (
        restoration ||
        'Not detected'
      ),
    'Status = RESTORED',
    '',
    'Regards,',
    'NOC'
  );

  return {
    subject,
    body:
      body.join('\n'),
  };
}

export function formatFinalClosurePackage(
  report: IncidentReport,
  checklist: ClosureChecklist
): string {
  const checklistLines = [
    (
      checklist.statementUpWag
        ? '✅'
        : '❌'
    ) +
      ' Statement Up WAG',
    (
      matoaClearanceComplete(
        checklist
      )
        ? '✅'
        : '❌'
    ) +
      ' Matoa Clearance',
    '  ' +
      (
        checklist.matoaClearance
          .statusTt
          ? '✅'
          : '❌'
      ) +
      ' Status TT',
    '  ' +
      (
        checklist.matoaClearance
          .eventAndPhoto
          ? '✅'
          : '❌'
      ) +
      ' Event and Photo',
    '  ' +
      (
        checklist.matoaClearance
          .rfo
          ? '✅'
          : '❌'
      ) +
      ' RFO',
    (
      checklist.sentClosedEmail
        ? '✅'
        : '❌'
    ) +
      ' Sent Closed Email',
  ];

  return [
    formatReport(report),
    '',
    'Closure Administration',
    ...checklistLines,
    '',
    'Closure Readiness = ' +
      closureChecklistScore(
        checklist
      ) +
      '%',
  ].join('\n');
}
