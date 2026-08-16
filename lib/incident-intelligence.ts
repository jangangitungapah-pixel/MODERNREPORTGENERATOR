import {
  closureChecklistComplete,
  type ClosureChecklist,
} from './closure';

import {
  type IncidentReport,
  type LinkMarker,
} from './report';

export type IntelligenceSeverity =
  | 'info'
  | 'warning'
  | 'critical';

export type IntelligenceFinding = {
  id: string;
  severity: IntelligenceSeverity;
  title: string;
  detail: string;
  field:
    | 'ticket'
    | 'occurTime'
    | 'dispatchTime'
    | 'pic'
    | 'rootcause'
    | 'cutPoint'
    | 'progress'
    | 'status'
    | 'closure';
};

function parseDateTime(
  value: string
): number | null {
  const normalized =
    value.trim();

  const match =
    normalized.match(
      /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/
    );

  if (!match) {
    return null;
  }

  const [, day, month, year, hour, minute] =
    match;

  const date =
    new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      0,
      0
    );

  const time =
    date.getTime();

  return Number.isNaN(time)
    ? null
    : time;
}

function progressDateTime({
  occurTime,
  date,
  time,
}: {
  occurTime: string;
  date?: string;
  time: string;
}): number | null {
  const explicit =
    date?.trim();

  if (explicit) {
    return parseDateTime(
      `${explicit} ${time}`
    );
  }

  const occur =
    parseDateTime(
      occurTime
    );

  if (occur === null) {
    return null;
  }

  const match =
    time.match(
      /^(\d{2}):(\d{2})$/
    );

  if (!match) {
    return null;
  }

  const [, hour, minute] =
    match;

  const candidate =
    new Date(occur);

  candidate.setHours(
    Number(hour),
    Number(minute),
    0,
    0
  );

  let result =
    candidate.getTime();

  if (
    result <
    occur -
      12 * 60 * 60 * 1_000
  ) {
    result +=
      24 * 60 * 60 * 1_000;
  }

  return result;
}

function restoredFromText(
  report: IncidentReport
): boolean {
  const restoredPattern =
    /\b(link\s+(already\s+)?up|link\s+normal|service\s+restored|traffic\s+normal|already\s+up|link\s+up)\b/i;

  return report.progress.some(
    (entry) =>
      restoredPattern.test(
        entry.text
      )
  );
}

function markerLooksDown(
  marker:
    | LinkMarker
    | undefined
): boolean {
  return (
    marker === 'down' ||
    marker === 'warning'
  );
}

function pushMissing(
  findings: IntelligenceFinding[],
  report: IncidentReport,
  field:
    | 'ticket'
    | 'pic'
    | 'rootcause'
    | 'cutPoint',
  title: string
) {
  if (
    !report[field]
      .trim()
  ) {
    findings.push({
      id:
        `missing-${field}`,
      severity:
        field === 'ticket'
          ? 'critical'
          : 'warning',
      title,
      detail:
        'Complete this field before final delivery or handover.',
      field,
    });
  }
}

export function analyzeIncident({
  report,
  closureChecklist,
}: {
  report: IncidentReport;
  closureChecklist: ClosureChecklist;
}): IntelligenceFinding[] {
  const findings:
    IntelligenceFinding[] = [];

  pushMissing(
    findings,
    report,
    'ticket',
    'TT number is missing'
  );
  pushMissing(
    findings,
    report,
    'pic',
    'PIC is missing'
  );
  pushMissing(
    findings,
    report,
    'rootcause',
    'Root cause is missing'
  );
  pushMissing(
    findings,
    report,
    'cutPoint',
    'Cut point is missing'
  );

  const occur =
    parseDateTime(
      report.occurTime
    );
  const dispatch =
    parseDateTime(
      report.dispatchTime
    );

  if (
    occur !== null &&
    dispatch !== null &&
    dispatch < occur
  ) {
    findings.push({
      id:
        'dispatch-before-occur',
      severity: 'critical',
      title:
        'Dispatch precedes occurrence',
      detail:
        'Dispatch time is earlier than occur time. Verify the timestamps.',
      field:
        'dispatchTime',
    });
  }

  if (occur !== null) {
    const invalidProgress =
      report.progress.find(
        (entry) => {
          const timestamp =
            progressDateTime({
              occurTime:
                report.occurTime,
              date:
                entry.date,
              time:
                entry.time,
            });

          return (
            timestamp !== null &&
            timestamp <
              occur -
                5 * 60 * 1_000
          );
        }
      );

    if (invalidProgress) {
      findings.push({
        id:
          'progress-before-occur',
        severity:
          'warning',
        title:
          'Timeline starts before occurrence',
        detail:
          `${invalidProgress.time} ${invalidProgress.text}`,
        field:
          'progress',
      });
    }
  }

  const restored =
    restoredFromText(
      report
    );

  if (
    restored &&
    markerLooksDown(
      report.primaryMarker
    )
  ) {
    findings.push({
      id:
        'restored-marker-conflict',
      severity:
        'critical',
      title:
        'Restored progress conflicts with link marker',
      detail:
        'Timeline indicates restoration while the primary marker is still Down/Warning.',
      field:
        'status',
    });
  }

  if (
    restored &&
    !closureChecklistComplete(
      closureChecklist
    )
  ) {
    findings.push({
      id:
        'restored-closure-pending',
      severity:
        'warning',
      title:
        'Technical restoration is complete but closure tasks remain',
      detail:
        'Finish WAG statement, Matoa clearance, RFO and closed email tasks.',
      field:
        'closure',
    });
  }

  const statusTag =
    report.statusTag
      ?.trim()
      .toLowerCase() ??
    '';

  if (
    statusTag.includes(
      'close'
    ) &&
    markerLooksDown(
      report.primaryMarker
    )
  ) {
    findings.push({
      id:
        'closed-marker-conflict',
      severity:
        'critical',
      title:
        'Closed status conflicts with degraded marker',
      detail:
        'Status is closed while the primary marker is Down/Warning.',
      field:
        'status',
    });
  }

  return findings;
}

export function whatIsPending({
  report,
  closureChecklist,
}: {
  report: IncidentReport;
  closureChecklist: ClosureChecklist;
}): string[] {
  const pending:
    string[] = [];

  if (!report.ticket.trim()) {
    pending.push(
      'Assign trouble ticket number'
    );
  }
  if (!report.pic.trim()) {
    pending.push(
      'Assign PIC'
    );
  }
  if (!report.rootcause.trim()) {
    pending.push(
      'Confirm root cause'
    );
  }
  if (!report.cutPoint.trim()) {
    pending.push(
      'Confirm cut point'
    );
  }
  if (
    report.progress.length ===
    0
  ) {
    pending.push(
      'Add operational progress update'
    );
  }

  if (
    !closureChecklist
      .statementUpWag
  ) {
    pending.push(
      'Send Statement Up WAG'
    );
  }
  if (
    !closureChecklist
      .matoaClearance
      .statusTt
  ) {
    pending.push(
      'Complete Matoa TT status'
    );
  }
  if (
    !closureChecklist
      .matoaClearance
      .eventAndPhoto
  ) {
    pending.push(
      'Complete Matoa event & photo'
    );
  }
  if (
    !closureChecklist
      .matoaClearance
      .rfo
  ) {
    pending.push(
      'Complete Matoa RFO'
    );
  }
  if (
    !closureChecklist
      .sentClosedEmail
  ) {
    pending.push(
      'Send closed email'
    );
  }

  return pending;
}
