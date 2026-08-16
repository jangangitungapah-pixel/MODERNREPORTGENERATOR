import {
  closureChecklistCompletedCount,
} from './closure';

import {
  type IncidentRecord,
} from './workspace';

import {
  whatIsPending,
} from './incident-intelligence';

function incidentHeadline(
  incident: IncidentRecord
): string {
  const report =
    incident.report;

  return [
    report.ticket ||
      'NO-TT',
    report.region ||
      'UNASSIGNED',
    report.summary ||
      'Untitled incident',
  ].join(' · ');
}

export function buildShiftHandover(
  incidents: IncidentRecord[]
): string {
  const active =
    incidents.filter(
      (incident) =>
        incident.status ===
        'active'
    );

  const archived =
    incidents.length -
    active.length;

  const lines: string[] = [
    'REPORTOS SHIFT HANDOVER',
    '',
    `Active TT: ${active.length}`,
    `Archived TT: ${archived}`,
    '',
  ];

  if (active.length === 0) {
    lines.push(
      'No active trouble tickets require handover.'
    );

    return lines.join('\n');
  }

  active.forEach(
    (incident, index) => {
      const report =
        incident.report;

      const latest =
        report.progress[
          report.progress.length -
            1
        ];

      const pending =
        whatIsPending({
          report,
          closureChecklist:
            incident.closureChecklist,
        });

      lines.push(
        `${index + 1}. ${incidentHeadline(incident)}`,
        `   PIC: ${report.pic || 'Pending'}`,
        `   Latest: ${latest ? `${latest.time} ${latest.text}` : 'No progress update'}`,
        `   Closure: ${closureChecklistCompletedCount(incident.closureChecklist)}/5`,
        `   Pending: ${pending.length > 0 ? pending.join('; ') : 'None'}`,
        ''
      );
    }
  );

  return lines.join('\n').trimEnd();
}
