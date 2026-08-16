import {
  detectProgressKind,
  progressTimeToMinutes,
  type IncidentReport,
  type ProgressEntry,
  type ProgressKind,
} from './report';

import {
  type IncidentLifecycle,
  type IncidentRecord,
} from './workspace';

import {
  closureChecklistComplete,
  closureChecklistScore,
} from './closure';

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

export type OperationalStatus =
  | 'new'
  | 'dispatched'
  | 'onsite'
  | 'repair'
  | 'restored';

export type OperationalIncidentView = {
  incidentId: string;
  lifecycle: IncidentLifecycle;
  region: string;
  ticket: string;
  summary: string;
  pic: string;
  status: OperationalStatus;
  ageMinutes: number | null;
  staleMinutes: number | null;
  needsAttention: boolean;
  criticalAttention: boolean;
  closureScore: number;
  closureComplete: boolean;
  closurePending: boolean;
  progressCount: number;
  lastActivityTime: string;
  lastActivityText: string;
};

export type WorkspaceOperationalSummary = {
  totalActive: number;
  running: number;
  restored: number;
  attention: number;
  critical: number;
  closurePending: number;
  averageRunningAgeMinutes:
    number | null;
};

const STATUS_LABELS: Record<
  OperationalStatus,
  string
> = {
  new: 'NEW',
  dispatched: 'DISPATCHED',
  onsite: 'ON SITE',
  repair: 'REPAIR',
  restored: 'RESTORED',
};

const STATUS_RANK: Record<
  OperationalStatus,
  number
> = {
  new: 0,
  dispatched: 1,
  onsite: 2,
  repair: 3,
  restored: 4,
};

function progressKindToStatus(
  kind: ProgressKind
): OperationalStatus {
  if (kind === 'dispatch') {
    return 'dispatched';
  }

  if (kind === 'onsite') {
    return 'onsite';
  }

  if (kind === 'repair') {
    return 'repair';
  }

  if (kind === 'restored') {
    return 'restored';
  }

  return 'new';
}

export function operationalStatusLabel(
  status: OperationalStatus
): string {
  return STATUS_LABELS[status];
}

export function parseReportDateTime(
  value: string
): number | null {
  const match =
    value
      .trim()
      .match(
        /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/
      );

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  const parsed =
    new Date(
      year,
      month - 1,
      day,
      hour,
      minute,
      0,
      0
    );

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !==
      month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute
  ) {
    return null;
  }

  return parsed.getTime();
}

function progressTimestamp(
  report: IncidentReport,
  time: string
): number | null {
  const start =
    parseReportDateTime(
      report.occurTime
    );

  const progressMinutes =
    progressTimeToMinutes(
      time
    );

  if (
    start === null ||
    progressMinutes === null
  ) {
    return null;
  }

  const startDate =
    new Date(start);

  const startMinutes =
    startDate.getHours() * 60 +
    startDate.getMinutes();

  const hours =
    Math.floor(
      progressMinutes / 60
    );

  const minutes =
    progressMinutes % 60;

  let candidate =
    new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
      hours,
      minutes,
      0,
      0
    ).getTime();

  //
  // A progress clock earlier than the
  // occur clock is treated as a midnight
  // rollover into the next calendar day.
  //
  if (
    progressMinutes <
    startMinutes
  ) {
    candidate += DAY_MS;
  }

  return candidate;
}

function latestProgress(
  report: IncidentReport
): {
  entry: ProgressEntry | null;
  timestamp: number | null;
} {
  let bestEntry:
    ProgressEntry | null = null;

  let bestTimestamp:
    number | null = null;

  for (const entry of report.progress) {
    const timestamp =
      progressTimestamp(
        report,
        entry.time
      );

    if (
      timestamp !== null &&
      (
        bestTimestamp === null ||
        timestamp > bestTimestamp
      )
    ) {
      bestTimestamp = timestamp;
      bestEntry = entry;
    }
  }

  if (
    bestEntry === null &&
    report.progress.length > 0
  ) {
    bestEntry =
      report.progress[
        report.progress.length - 1
      ];
  }

  return {
    entry: bestEntry,
    timestamp: bestTimestamp,
  };
}

function hasExplicitUnresolvedMarker(
  report: IncidentReport
): boolean {
  const markers = [
    report.primaryMarker,
    ...(report.impactLinks ?? []).map(
      (entry) => entry.marker
    ),
    ...(report.cutPoints ?? []).map(
      (entry) => entry.marker
    ),
  ];

  return markers.some(
    (marker) =>
      marker === 'down' ||
      marker === 'warning'
  );
}

export function deriveOperationalStatus(
  report: IncidentReport
): OperationalStatus {
  let status:
    OperationalStatus = 'new';

  const unresolvedStructuredLink =
    hasExplicitUnresolvedMarker(
      report
    );

  for (const entry of report.progress) {
    const candidate =
      progressKindToStatus(
        detectProgressKind(
          entry.text
        )
      );

    if (
      candidate === 'restored' &&
      unresolvedStructuredLink
    ) {
      //
      // One child link can be UP while
      // another Impact Link / CP is still
      // explicitly DOWN. Do not promote
      // the whole incident to RESTORED.
      //
      continue;
    }

    if (
      STATUS_RANK[candidate] >
      STATUS_RANK[status]
    ) {
      status = candidate;
    }
  }

  return status;
}

export function buildIncidentOperationalView(
  incident: IncidentRecord,
  nowEpoch: number
): OperationalIncidentView {
  const report =
    incident.report;

  const status =
    deriveOperationalStatus(
      report
    );

  const startAt =
    parseReportDateTime(
      report.occurTime
    );

  const latest =
    latestProgress(report);

  const lastActivityAt =
    latest.timestamp ??
    startAt;

  const endAt =
    status === 'restored'
      ? lastActivityAt
      : null;

  const ageMinutes =
    startAt === null
      ? null
      : Math.max(
          0,
          Math.floor(
            (
              (
                endAt ??
                nowEpoch
              ) -
              startAt
            ) /
              MINUTE_MS
          )
        );

  const staleMinutes =
    lastActivityAt === null
      ? null
      : Math.max(
          0,
          Math.floor(
            (
              nowEpoch -
              lastActivityAt
            ) /
              MINUTE_MS
          )
        );

  const closureScore =
    closureChecklistScore(
      incident.closureChecklist
    );

  const closureComplete =
    closureChecklistComplete(
      incident.closureChecklist
    );

  const closurePending =
    incident.status ===
      'active' &&
    status === 'restored' &&
    !closureComplete;

  const running =
    incident.status ===
      'active' &&
    status !== 'restored';

  const needsAttention =
    running &&
    staleMinutes !== null &&
    staleMinutes >= 60;

  const criticalAttention =
    running &&
    staleMinutes !== null &&
    staleMinutes >= 120;

  return {
    incidentId:
      incident.id,
    lifecycle:
      incident.status,
    region:
      report.region,
    ticket:
      report.ticket,
    summary:
      report.summary,
    pic:
      report.pic,
    status,
    ageMinutes,
    staleMinutes,
    needsAttention,
    criticalAttention,
    closureScore,
    closureComplete,
    closurePending,
    progressCount:
      report.progress.length,
    lastActivityTime:
      latest.entry?.time ??
      '',
    lastActivityText:
      latest.entry?.text ??
      '',
  };
}

export function buildWorkspaceOperationalViews(
  incidents: IncidentRecord[],
  nowEpoch: number
): OperationalIncidentView[] {
  return incidents
    .map(
      (incident) =>
        buildIncidentOperationalView(
          incident,
          nowEpoch
        )
    )
    .sort(
      (left, right) => {
        if (
          left.lifecycle !==
          right.lifecycle
        ) {
          return left.lifecycle ===
            'active'
            ? -1
            : 1;
        }

        if (
          left.criticalAttention !==
          right.criticalAttention
        ) {
          return left.criticalAttention
            ? -1
            : 1;
        }

        if (
          left.needsAttention !==
          right.needsAttention
        ) {
          return left.needsAttention
            ? -1
            : 1;
        }

        if (
          left.closurePending !==
          right.closurePending
        ) {
          return left.closurePending
            ? -1
            : 1;
        }

        if (
          left.status !==
          right.status
        ) {
          return (
            STATUS_RANK[
              left.status
            ] -
            STATUS_RANK[
              right.status
            ]
          );
        }

        return (
          (
            right.ageMinutes ??
            -1
          ) -
          (
            left.ageMinutes ??
            -1
          )
        );
      }
    );
}

export function workspaceOperationalSummary(
  views: OperationalIncidentView[]
): WorkspaceOperationalSummary {
  const active =
    views.filter(
      (view) =>
        view.lifecycle ===
        'active'
    );

  const running =
    active.filter(
      (view) =>
        view.status !==
        'restored'
    );

  const restored =
    active.filter(
      (view) =>
        view.status ===
        'restored'
    );

  const attention =
    running.filter(
      (view) =>
        view.needsAttention
    );

  const critical =
    running.filter(
      (view) =>
        view.criticalAttention
    );

  const closurePending =
    active.filter(
      (view) =>
        view.closurePending
    );

  const runningAges =
    running
      .map(
        (view) =>
          view.ageMinutes
      )
      .filter(
        (
          value
        ): value is number =>
          value !== null
      );

  const averageRunningAgeMinutes =
    runningAges.length === 0
      ? null
      : Math.round(
          runningAges.reduce(
            (total, value) =>
              total + value,
            0
          ) /
            runningAges.length
        );

  return {
    totalActive:
      active.length,
    running:
      running.length,
    restored:
      restored.length,
    attention:
      attention.length,
    critical:
      critical.length,
    closurePending:
      closurePending.length,
    averageRunningAgeMinutes,
  };
}

export function formatOperationalDuration(
  minutes: number | null
): string {
  if (minutes === null) {
    return '—';
  }

  if (minutes < 60) {
    return minutes + 'm';
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  const remaining =
    minutes % 60;

  if (hours < 24) {
    return remaining === 0
      ? hours + 'h'
      : hours +
          'h ' +
          remaining +
          'm';
  }

  const days =
    Math.floor(
      hours / 24
    );

  const dayHours =
    hours % 24;

  return dayHours === 0
    ? days + 'd'
    : days +
        'd ' +
        dayHours +
        'h';
}
