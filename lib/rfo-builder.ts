import {
  type IncidentReport,
} from './report';

function clean(
  value: string,
  fallback: string
): string {
  const normalized =
    value.trim();

  return normalized || fallback;
}

export function buildRfoDraft(
  report: IncidentReport
): string {
  const latest =
    report.progress[
      report.progress.length - 1
    ];

  return [
    'RFO / INCIDENT CLOSURE',
    '',
    `TT: ${clean(report.ticket, 'Pending TT')}`,
    `Region: ${clean(report.region, 'Unassigned')}`,
    `Incident: ${clean(report.summary, 'Pending summary')}`,
    `Occur Time: ${clean(report.occurTime, 'Pending')}`,
    `Dispatch Time: ${clean(report.dispatchTime, 'Pending')}`,
    `PIC: ${clean(report.pic, 'Pending')}`,
    `Root Cause: ${clean(report.rootcause, 'Pending investigation')}`,
    `Cut Point: ${clean(report.cutPoint, 'Pending confirmation')}`,
    `Latest Progress: ${latest ? `${latest.time} ${latest.text}` : 'No progress update yet'}`,
    '',
    'Corrective Action:',
    latest
      ? latest.text
      : 'Pending operational update.',
    '',
    'Preventive Action:',
    'Review incident findings, route condition, and recurring-risk indicators before final closure.',
  ].join('\n');
}
