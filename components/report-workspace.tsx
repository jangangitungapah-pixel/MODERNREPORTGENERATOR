'use client';

import Link from 'next/link';

import {
  Activity,
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronRight,
  Clipboard,
  Clock3,
  Command,
  Copy,
  FileOutput,
  FilePlus2,
  FileText,
  FolderArchive,
  Gauge,
  Layers3,
  Link2,
  Mail,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
} from 'lucide-react';

import {
  AnimatePresence,
  MotionConfig,
  motion,
} from 'motion/react';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  EMPTY_REPORT,
  SAMPLE_REPORT,
  completionScore,
  currentProgressStamp,
  detectProgressKind,
  duplicateProgressTimes,
  formatReport,
  inferProgressDates,
  parseIncidentReport,
  progressDateFromInput,
  progressDateToInput,
  progressDuplicateKey,
  sortProgressChronologically,
  type CutPointEntry,
  type ImpactLink,
  type IncidentReport,
  type LinkMarker,
  type ProgressEntry,
} from '@/lib/report';

import {
  createIncidentRecord,
  deserializeWorkspace,
  filterIncidents,
  serializeWorkspace,
  setIncidentArchived,
  sortIncidentsByUpdatedAt,
  setIncidentClosureChecklist,
  upsertIncidentReport,
  type IncidentRecord,
} from '@/lib/workspace';

import {
  buildWorkspaceOperationalViews,
  formatOperationalDuration,
  operationalStatusLabel,
  workspaceOperationalSummary,
} from '@/lib/operations';

import {
  CLOSURE_ATOMIC_TASK_COUNT,
  closureChecklistComplete,
  closureChecklistCompletedCount,
  closureChecklistScore,
  createDefaultClosureChecklist,
  matoaClearanceComplete,
  matoaClearanceCompletedCount,
  toggleClosureChecklistTask,
  type ClosureTaskKey,
} from '@/lib/closure';

import {
  PROGRESS_MACROS,
  progressMacroSuggestions,
  type ProgressMacro,
} from '@/lib/progress-assistant';

import {
  buildClosedEmailDraft,
  buildDeliveryValidation,
  formatFinalClosurePackage,
  formatWagDelivery,
} from '@/lib/delivery';

const STORAGE_KEY = 'reportos:draft:v1';
const WORKSPACE_STORAGE_KEY =
  'reportos:workspace:v1';

type MobilePane = 'compose' | 'preview';
type WorkspaceMode =
  | 'compose'
  | 'operations'
  | 'archive';

const PROGRESS_KIND_LABELS = {
  coordination: 'Coordination',
  dispatch: 'Dispatch',
  onsite: 'On site',
  repair: 'Repair',
  restored: 'Restored',
  update: 'Update',
} as const;

const LINK_MARKER_OPTIONS: Array<{
  value: LinkMarker;
  label: string;
  symbol: string;
}> = [
  {
    value: 'unknown',
    label: 'Unknown',
    symbol: '•',
  },
  {
    value: 'down',
    label: 'Down',
    symbol: '❌',
  },
  {
    value: 'warning',
    label: 'Warning',
    symbol: '⚠️',
  },
  {
    value: 'up',
    label: 'Up',
    symbol: '✅',
  },
];

function MarkerSelector({
  value,
  onChange,
  compact = false,
}: {
  value:
    | LinkMarker
    | undefined;
  onChange: (
    value: LinkMarker
  ) => void;
  compact?: boolean;
}) {
  const current =
    value ?? 'unknown';

  return (
    <div
      className={
        compact
          ? 'marker-selector marker-selector-compact'
          : 'marker-selector'
      }
      role="group"
      aria-label="Link status"
    >
      {LINK_MARKER_OPTIONS.map(
        (option) => (
          <button
            className={
              current ===
              option.value
                ? 'marker-option marker-option-active'
                : 'marker-option'
            }
            data-marker={
              option.value
            }
            key={
              option.value
            }
            type="button"
            title={
              option.label
            }
            aria-pressed={
              current ===
              option.value
            }
            onClick={() =>
              onChange(
                option.value
              )
            }
          >
            <span>
              {
                option.symbol
              }
            </span>

            {!compact ? (
              <small>
                {
                  option.label
                }
              </small>
            ) : null}
          </button>
        )
      )}
    </div>
  );
}

function createDispatchEntityId(
  prefix: string
): string {
  if (
    typeof crypto !==
      'undefined' &&
    'randomUUID' in crypto
  ) {
    return (
      prefix +
      '-' +
      crypto.randomUUID()
    );
  }

  return (
    prefix +
    '-' +
    Date.now() +
    '-' +
    Math.random()
      .toString(36)
      .slice(2, 8)
  );
}

function syncCutPointAggregates(
  entries: CutPointEntry[]
): Pick<
  IncidentReport,
  'rootcause' | 'cutPoint'
> {
  return {
    rootcause:
      entries
        .map(
          (entry) =>
            (
              entry.label.trim() +
              ' ' +
              entry.rootcause.trim()
            ).trim()
        )
        .filter(Boolean)
        .join('\n'),
    cutPoint:
      entries
        .map(
          (entry) =>
            (
              entry.label.trim() +
              ' ' +
              entry.cutPoint.trim()
            ).trim()
        )
        .filter(Boolean)
        .join('\n'),
  };
}

type FieldProps = {
  label: string;
  value: string;
  placeholder?: string;
  hint?: string;
  wide?: boolean;
  multiline?: boolean;
  onChange: (value: string) => void;
};

function Field({
  label,
  value,
  placeholder,
  hint,
  wide,
  multiline,
  onChange,
}: FieldProps) {
  const className =
    'field' + (wide ? ' field-wide' : '');

  return (
    <label className={className}>
      <span className="field-label-row">
        <span className="field-label">
          {label}
        </span>

        {hint ? (
          <span className="field-hint">
            {hint}
          </span>
        ) : null}
      </span>

      {multiline ? (
        <textarea
          className="control control-textarea"
          value={value}
          placeholder={placeholder}
          rows={3}
          onChange={(event) =>
            onChange(event.target.value)
          }
        />
      ) : (
        <input
          className="control"
          value={value}
          placeholder={placeholder}
          onChange={(event) =>
            onChange(event.target.value)
          }
        />
      )}
    </label>
  );
}

function formatIncidentTimestamp(
  value: string
): string {
  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return 'Unknown time';
  }

  return new Intl.DateTimeFormat(
    'en-GB',
    {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }
  ).format(parsed);
}

function createClientIncidentId(): string {
  if (
    typeof crypto !==
      'undefined' &&
    'randomUUID' in crypto
  ) {
    return crypto.randomUUID();
  }

  return (
    'incident-' +
    Date.now() +
    '-' +
    Math.random()
      .toString(36)
      .slice(2, 9)
  );
}

function AppMark() {
  return (
    <div className="app-mark" aria-hidden="true">
      <span className="app-mark-core" />
      <span className="app-mark-orbit app-mark-orbit-one" />
      <span className="app-mark-orbit app-mark-orbit-two" />
    </div>
  );
}

export function ReportWorkspace() {
  const [report, setReport] =
    useState<IncidentReport>(SAMPLE_REPORT);

  const [hydrated, setHydrated] =
    useState(false);

  const [mobilePane, setMobilePane] =
    useState<MobilePane>('compose');

  const [
    workspaceMode,
    setWorkspaceMode,
  ] = useState<WorkspaceMode>(
    'compose'
  );

  const [
    incidentRecords,
    setIncidentRecords,
  ] = useState<
    IncidentRecord[]
  >([]);

  const [
    activeIncidentId,
    setActiveIncidentId,
  ] = useState('');

  const [
    archiveQuery,
    setArchiveQuery,
  ] = useState('');

  const [
    nowEpoch,
    setNowEpoch,
  ] = useState(0);

  const [entryDate, setEntryDate] =
    useState('');

  const [entryTime, setEntryTime] =
    useState('');

  const [entryText, setEntryText] =
    useState('');

  const [copied, setCopied] =
    useState(false);

  const [
    deliveryCopied,
    setDeliveryCopied,
  ] = useState<
    | 'wag'
    | 'email'
    | 'package'
    | null
  >(null);

  const [rawImport, setRawImport] =
    useState('');

  const [
    importFeedback,
    setImportFeedback,
  ] = useState<{
    tone:
      | 'neutral'
      | 'success'
      | 'error';
    title: string;
    detail: string;
  } | null>(null);

  const [
    editingProgressId,
    setEditingProgressId,
  ] = useState<string | null>(
    null
  );

  const [
    editingProgressDate,
    setEditingProgressDate,
  ] = useState('');

  const [
    editingProgressTime,
    setEditingProgressTime,
  ] = useState('');

  const [
    editingProgressText,
    setEditingProgressText,
  ] = useState('');

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      try {
        const workspace =
          deserializeWorkspace(
            window.localStorage.getItem(
              WORKSPACE_STORAGE_KEY
            )
          );

        if (
          workspace &&
          workspace.incidents.length >
            0
        ) {
          const active =
            workspace.incidents.find(
              (incident) =>
                incident.id ===
                workspace.activeIncidentId
            ) ??
            workspace.incidents[0];

          setIncidentRecords(
            workspace.incidents
          );

          setActiveIncidentId(
            active.id
          );

          setReport(
            active.report
          );
        } else {
          const savedDraft =
            window.localStorage.getItem(
              STORAGE_KEY
            );

          let initialReport =
            SAMPLE_REPORT;

          if (savedDraft) {
            try {
              initialReport =
                JSON.parse(
                  savedDraft
                ) as IncidentReport;
            } catch {
              initialReport =
                SAMPLE_REPORT;
            }
          }

          const incident =
            createIncidentRecord(
              createClientIncidentId(),
              initialReport
            );

          setIncidentRecords([
            incident,
          ]);

          setActiveIncidentId(
            incident.id
          );

          setReport(
            incident.report
          );
        }
      } catch {
        const incident =
          createIncidentRecord(
            createClientIncidentId(),
            SAMPLE_REPORT
          );

        setIncidentRecords([
          incident,
        ]);

        setActiveIncidentId(
          incident.id
        );

        setReport(
          incident.report
        );
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      !hydrated ||
      !activeIncidentId ||
      incidentRecords.length === 0
    ) {
      return;
    }

    const now =
      new Date().toISOString();

    const syncedIncidents =
      upsertIncidentReport(
        incidentRecords,
        activeIncidentId,
        report,
        now
      );

    window.localStorage.setItem(
      WORKSPACE_STORAGE_KEY,
      serializeWorkspace({
        version: 1,
        activeIncidentId,
        incidents:
          syncedIncidents,
      })
    );

    //
    // Keep the legacy draft key during
    // F3 migration so rollback never
    // destroys the currently open report.
    //
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(report)
    );
  }, [
    activeIncidentId,
    hydrated,
    incidentRecords,
    report,
  ]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    let cancelled =
      false;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      const stamp =
        currentProgressStamp();

      setEntryDate(
        (current) =>
          current ||
          stamp.date
      );

      setEntryTime(
        (current) =>
          current ||
          stamp.time
      );
    });

    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  useEffect(() => {
    const updateClock = () => {
      setNowEpoch(
        Date.now()
      );
    };

    const initialTick =
      window.setTimeout(
        updateClock,
        0
      );

    const timer =
      window.setInterval(
        updateClock,
        60_000
      );

    return () => {
      window.clearTimeout(
        initialTick
      );

      window.clearInterval(
        timer
      );
    };
  }, []);

  const generated = useMemo(
    () => formatReport(report),
    [report]
  );

  const score = useMemo(
    () => completionScore(report),
    [report]
  );

  const duplicateTimes =
    useMemo(
      () =>
        new Set(
          duplicateProgressTimes(
            report.progress
          )
        ),
      [report.progress]
    );

  const incidentRecordsForView =
    useMemo(
      () =>
        sortIncidentsByUpdatedAt(
          activeIncidentId
            ? upsertIncidentReport(
                incidentRecords,
                activeIncidentId,
                report,
                incidentRecords.find(
                  (incident) =>
                    incident.id ===
                    activeIncidentId
                )?.updatedAt ??
                  new Date().toISOString()
              )
            : incidentRecords
        ),
      [
        activeIncidentId,
        incidentRecords,
        report,
      ]
    );

  const filteredIncidents =
    useMemo(
      () =>
        filterIncidents(
          incidentRecordsForView,
          archiveQuery
        ),
      [
        archiveQuery,
        incidentRecordsForView,
      ]
    );

  const operationalViews =
    useMemo(
      () =>
        buildWorkspaceOperationalViews(
          incidentRecordsForView,
          nowEpoch
        ),
      [
        incidentRecordsForView,
        nowEpoch,
      ]
    );

  const operationalSummary =
    useMemo(
      () =>
        workspaceOperationalSummary(
          operationalViews
        ),
      [operationalViews]
    );

  const runningOperationalViews =
    operationalViews.filter(
      (view) =>
        view.lifecycle ===
        'active'
    );

  const activeIncident =
    incidentRecordsForView.find(
      (incident) =>
        incident.id ===
        activeIncidentId
    );

  const activeClosureChecklist =
    activeIncident?.closureChecklist ??
    createDefaultClosureChecklist();

  const activeClosureCompleted =
    closureChecklistCompletedCount(
      activeClosureChecklist
    );

  const activeClosureScore =
    closureChecklistScore(
      activeClosureChecklist
    );

  const activeClosureComplete =
    closureChecklistComplete(
      activeClosureChecklist
    );

  const activeMatoaComplete =
    matoaClearanceComplete(
      activeClosureChecklist
    );

  const activeMatoaCompleted =
    matoaClearanceCompletedCount(
      activeClosureChecklist
    );

  const activeOperationalView =
    operationalViews.find(
      (view) =>
        view.incidentId ===
        activeIncidentId
    );

  const activeProgressStatus =
    activeOperationalView?.status ??
    'new';

  const suggestedProgressMacros =
    progressMacroSuggestions(
      activeProgressStatus
    );

  const deliveryValidation =
    useMemo(
      () =>
        buildDeliveryValidation(
          report,
          activeClosureChecklist
        ),
      [
        activeClosureChecklist,
        report,
      ]
    );

  const closedEmailDraft =
    useMemo(
      () =>
        buildClosedEmailDraft(
          report
        ),
      [report]
    );

  const finalClosurePackage =
    useMemo(
      () =>
        formatFinalClosurePackage(
          report,
          activeClosureChecklist
        ),
      [
        activeClosureChecklist,
        report,
      ]
    );

  const activeIncidentCount =
    incidentRecordsForView.filter(
      (incident) =>
        incident.status ===
        'active'
    ).length;

  const archivedIncidentCount =
    incidentRecordsForView.filter(
      (incident) =>
        incident.status ===
        'archived'
    ).length;

  function snapshotCurrentIncident(
    records: IncidentRecord[] =
      incidentRecords
  ): IncidentRecord[] {
    if (!activeIncidentId) {
      return records;
    }

    return upsertIncidentReport(
      records,
      activeIncidentId,
      report
    );
  }

  function setComposerTimestampNow() {
    const stamp =
      currentProgressStamp();

    setEntryDate(
      stamp.date
    );

    setEntryTime(
      stamp.time
    );
  }

  function createNewIncident() {
    const current =
      snapshotCurrentIncident();

    const incident =
      createIncidentRecord(
        createClientIncidentId(),
        EMPTY_REPORT
      );

    setIncidentRecords([
      incident,
      ...current,
    ]);

    setActiveIncidentId(
      incident.id
    );

    setReport(
      incident.report
    );

    setComposerTimestampNow();
    setEntryText('');
    setRawImport('');
    setImportFeedback(null);
    cancelEditProgress();
    setWorkspaceMode('compose');
    setMobilePane('compose');
  }

  function openIncident(
    incidentId: string
  ) {
    if (
      incidentId ===
      activeIncidentId
    ) {
      setWorkspaceMode(
        'compose'
      );
      return;
    }

    const current =
      snapshotCurrentIncident();

    const target =
      current.find(
        (incident) =>
          incident.id ===
          incidentId
      );

    if (!target) {
      return;
    }

    setIncidentRecords(
      current
    );

    setActiveIncidentId(
      target.id
    );

    setReport(
      target.report
    );

    setComposerTimestampNow();
    setEntryText('');
    setRawImport('');
    setImportFeedback(null);
    cancelEditProgress();
    setWorkspaceMode('compose');
    setMobilePane('compose');
  }

  function toggleIncidentArchive(
    incidentId: string
  ) {
    const current =
      snapshotCurrentIncident();

    const target =
      current.find(
        (incident) =>
          incident.id ===
          incidentId
      );

    if (!target) {
      return;
    }

    setIncidentRecords(
      setIncidentArchived(
        current,
        incidentId,
        target.status !==
          'archived'
      )
    );
  }

  function toggleClosureTask(
    task: ClosureTaskKey
  ) {
    if (!activeIncidentId) {
      return;
    }

    const nextChecklist =
      toggleClosureChecklistTask(
        activeClosureChecklist,
        task
      );

    setIncidentRecords(
      (current) =>
        setIncidentClosureChecklist(
          current,
          activeIncidentId,
          nextChecklist
        )
    );
  }

  function updatePrimaryMarker(
    marker: LinkMarker
  ) {
    setReport(
      (current) => ({
        ...current,
        primaryMarker:
          marker,
      })
    );
  }

  function updatePrimaryStatusTag(
    value: string
  ) {
    setReport(
      (current) => ({
        ...current,
        statusTag: value,
      })
    );
  }

  function addImpactLink() {
    setReport(
      (current) => ({
        ...current,
        impactLinks: [
          ...(current.impactLinks ??
            []),
          {
            id:
              createDispatchEntityId(
                'impact'
              ),
            marker:
              'unknown',
            region: '',
            statusTag: '',
            summary: '',
            ticket: '',
          },
        ],
      })
    );
  }

  function updateImpactLink<
    Key extends keyof ImpactLink
  >(
    id: string,
    key: Key,
    value: ImpactLink[Key]
  ) {
    setReport(
      (current) => ({
        ...current,
        impactLinks:
          (
            current.impactLinks ??
            []
          ).map(
            (entry) =>
              entry.id === id
                ? {
                    ...entry,
                    [key]:
                      value,
                  }
                : entry
          ),
      })
    );
  }

  function removeImpactLink(
    id: string
  ) {
    setReport(
      (current) => ({
        ...current,
        impactLinks:
          (
            current.impactLinks ??
            []
          ).filter(
            (entry) =>
              entry.id !== id
          ),
      })
    );
  }

  function addCutPoint() {
    setReport(
      (current) => {
        const existing =
          current.cutPoints ??
          [];

        let next:
          CutPointEntry[];

        if (
          existing.length === 0 &&
          (
            current.rootcause.trim() ||
            current.cutPoint.trim()
          )
        ) {
          //
          // Promote the existing simple CP
          // into CP1 instead of throwing
          // away data when multi-CP mode
          // is first enabled.
          //
          next = [
            {
              id:
                createDispatchEntityId(
                  'cp'
                ),
              label: 'CP1',
              rootcause:
                current.rootcause,
              cutPoint:
                current.cutPoint,
              marker:
                'unknown',
            },
          ];
        } else {
          next = [
            ...existing,
            {
              id:
                createDispatchEntityId(
                  'cp'
                ),
              label:
                'CP' +
                (
                  existing.length +
                  1
                ),
              rootcause: '',
              cutPoint: '',
              marker:
                'unknown',
            },
          ];
        }

        return {
          ...current,
          cutPoints: next,
          ...syncCutPointAggregates(
            next
          ),
        };
      }
    );
  }

  function updateCutPoint<
    Key extends keyof CutPointEntry
  >(
    id: string,
    key: Key,
    value: CutPointEntry[Key]
  ) {
    setReport(
      (current) => {
        const next =
          (
            current.cutPoints ??
            []
          ).map(
            (entry) =>
              entry.id === id
                ? {
                    ...entry,
                    [key]:
                      value,
                  }
                : entry
          );

        return {
          ...current,
          cutPoints: next,
          ...syncCutPointAggregates(
            next
          ),
        };
      }
    );
  }

  function removeCutPoint(
    id: string
  ) {
    setReport(
      (current) => {
        const next =
          (
            current.cutPoints ??
            []
          ).filter(
            (entry) =>
              entry.id !== id
          );

        return {
          ...current,
          cutPoints: next,
          ...syncCutPointAggregates(
            next
          ),
        };
      }
    );
  }

  function updateField<
    Key extends keyof IncidentReport
  >(
    key: Key,
    value: IncidentReport[Key]
  ) {
    setReport((current) => {
      if (
        key === 'rootcause' ||
        key === 'cutPoint'
      ) {
        return {
          ...current,
          [key]: value,
          cutPoints: [],
        };
      }

      return {
        ...current,
        [key]: value,
      };
    });
  }

  function addProgress() {
    const date =
      entryDate.trim();

    const time =
      entryTime.trim();

    const text =
      entryText.trim();

    if (
      !date ||
      !time ||
      !text
    ) {
      return;
    }

    setReport(
      (current) => {
        const nextEntry:
          ProgressEntry = {
          id:
            typeof crypto !==
              'undefined' &&
            'randomUUID' in
              crypto
              ? crypto.randomUUID()
              : String(
                  Date.now()
                ),
          date,
          time,
          text,
        };

        return {
          ...current,
          progress:
            sortProgressChronologically(
              [
                ...current.progress,
                nextEntry,
              ],
              current.occurTime
            ),
        };
      }
    );

    setComposerTimestampNow();
    setEntryText('');
  }

  function addProgressMacro(
    macro: ProgressMacro
  ) {
    const stamp =
      currentProgressStamp();

    setReport(
      (current) => {
        const nextEntry:
          ProgressEntry = {
          id:
            typeof crypto !==
              'undefined' &&
            'randomUUID' in
              crypto
              ? crypto.randomUUID()
              : (
                  String(
                    Date.now()
                  ) +
                  '-' +
                  macro.id
                ),
          date:
            stamp.date,
          time:
            stamp.time,
          text:
            macro.text,
        };

        return {
          ...current,
          progress:
            sortProgressChronologically(
              [
                ...current.progress,
                nextEntry,
              ],
              current.occurTime
            ),
        };
      }
    );

    setEntryDate(
      stamp.date
    );
    setEntryTime(
      stamp.time
    );
    setEntryText('');
  }

  function removeProgress(id: string) {
    setReport((current) => ({
      ...current,
      progress:
        current.progress.filter(
          (entry) =>
            entry.id !== id
        ),
    }));

    if (
      editingProgressId === id
    ) {
      setEditingProgressId(
        null
      );
    }
  }

  function beginEditProgress(
    entry: ProgressEntry
  ) {
    const inferredEntry =
      inferProgressDates(
        report.progress,
        report.occurTime
      ).find(
        (candidate) =>
          candidate.id ===
          entry.id
      );

    setEditingProgressId(
      entry.id
    );

    setEditingProgressDate(
      inferredEntry?.date ??
        entry.date ??
        ''
    );

    setEditingProgressTime(
      entry.time
    );

    setEditingProgressText(
      entry.text
    );
  }

  function cancelEditProgress() {
    setEditingProgressId(
      null
    );

    setEditingProgressDate('');
    setEditingProgressTime('');
    setEditingProgressText('');
  }

  function saveEditProgress() {
    if (
      !editingProgressId ||
      !editingProgressDate.trim() ||
      !editingProgressTime.trim() ||
      !editingProgressText.trim()
    ) {
      return;
    }

    setReport(
      (current) => ({
        ...current,
        progress:
          sortProgressChronologically(
            current.progress.map(
              (entry) =>
                entry.id ===
                editingProgressId
                  ? {
                      ...entry,
                      date:
                        editingProgressDate.trim(),
                      time:
                        editingProgressTime.trim(),
                      text:
                        editingProgressText.trim(),
                    }
                  : entry
            ),
            current.occurTime
          ),
      })
    );

    cancelEditProgress();
  }

  function moveProgress(
    id: string,
    direction: -1 | 1
  ) {
    setReport((current) => {
      const index =
        current.progress.findIndex(
          (entry) =>
            entry.id === id
        );

      const targetIndex =
        index + direction;

      if (
        index < 0 ||
        targetIndex < 0 ||
        targetIndex >=
          current.progress.length
      ) {
        return current;
      }

      const progress = [
        ...current.progress,
      ];

      const currentEntry =
        progress[index];

      progress[index] =
        progress[targetIndex];

      progress[targetIndex] =
        currentEntry;

      return {
        ...current,
        progress,
      };
    });
  }

  function sortTimeline() {
    setReport((current) => ({
      ...current,
      progress:
        sortProgressChronologically(
          current.progress,
          current.occurTime
        ),
    }));
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(
        generated
      );

      setCopied(true);

      window.setTimeout(
        () => setCopied(false),
        1600
      );
    } catch {
      setCopied(false);
    }
  }

  async function copyDelivery(
    target:
      | 'wag'
      | 'email'
      | 'package',
    value: string
  ) {
    try {
      await navigator.clipboard.writeText(
        value
      );

      setDeliveryCopied(
        target
      );

      window.setTimeout(
        () =>
          setDeliveryCopied(
            null
          ),
        1700
      );
    } catch {
      setDeliveryCopied(
        null
      );
    }
  }

  function finalizeIncident() {
    if (
      !activeIncidentId ||
      !deliveryValidation.canFinalize ||
      activeIncident?.status ===
        'archived'
    ) {
      return;
    }

    const current =
      snapshotCurrentIncident();

    setIncidentRecords(
      setIncidentArchived(
        current,
        activeIncidentId,
        true
      )
    );

    setWorkspaceMode(
      'archive'
    );
  }

  function resetToSample() {
    setReport(SAMPLE_REPORT);
    cancelEditProgress();
  }

  function clearReport() {
    setReport(EMPTY_REPORT);
    setComposerTimestampNow();
    setEntryText('');
    cancelEditProgress();
  }

  async function pasteFromClipboard() {
    try {
      const text =
        await navigator.clipboard.readText();

      if (!text.trim()) {
        setImportFeedback({
          tone: 'error',
          title: 'Clipboard is empty',
          detail:
            'Copy an incident report first, then try again.',
        });

        return;
      }

      setRawImport(text);

      setImportFeedback({
        tone: 'neutral',
        title: 'Clipboard captured',
        detail:
          'Payload is ready to parse and apply.',
      });
    } catch {
      setImportFeedback({
        tone: 'error',
        title: 'Clipboard access blocked',
        detail:
          'Paste the report manually into the payload area.',
      });
    }
  }

  function applySmartImport() {
    if (!rawImport.trim()) {
      setImportFeedback({
        tone: 'error',
        title: 'Nothing to parse',
        detail:
          'Paste a report payload before running Smart Parse.',
      });

      return;
    }

    const result =
      parseIncidentReport(
        rawImport
      );

    if (
      result.detectedFields.length ===
      0
    ) {
      setImportFeedback({
        tone: 'error',
        title: 'No report signals detected',
        detail:
          'The payload does not look like a supported incident report yet.',
      });

      return;
    }

    setReport({
      ...result.report,
      progress:
        sortProgressChronologically(
          result.report.progress
        ),
    });

    setComposerTimestampNow();
    setEntryText('');
    cancelEditProgress();

    setImportFeedback({
      tone:
        result.confidence >= 80
          ? 'success'
          : 'neutral',
      title:
        result.confidence === 100
          ? 'Perfect parse'
          : 'Import applied',
      detail:
        result.detectedFields.length +
        '/9 signals detected · ' +
        result.progressCount +
        ' progress updates · ' +
        result.confidence +
        '% confidence',
    });
  }

  return (
    <MotionConfig
      reducedMotion="user"
      transition={{
        duration: 0.24,
        ease: [0.2, 0.8, 0.2, 1],
      }}
    >
      <main className="app-shell">
        <div
          className="ambient ambient-one"
          aria-hidden="true"
        />

        <div
          className="ambient ambient-two"
          aria-hidden="true"
        />

        <aside className="sidebar glass-panel">
          <div className="brand-lockup">
            <AppMark />

            <div className="brand-copy">
              <strong>ReportOS</strong>
              <span>Ops intelligence</span>
            </div>
          </div>

          <nav
            className="side-nav"
            aria-label="Primary navigation"
          >
            <button
              className={
                workspaceMode ===
                'compose'
                  ? 'nav-item nav-item-active'
                  : 'nav-item'
              }
              type="button"
              onClick={() =>
                setWorkspaceMode(
                  'compose'
                )
              }
            >
              <WandSparkles size={18} />

              <span className="nav-copy">
                <strong>Composer</strong>
                <small>
                  Build incident report
                </small>
              </span>

              <ChevronRight
                className="nav-chevron"
                size={15}
              />
            </button>

            <button
              className={
                workspaceMode ===
                  'operations'
                  ? 'nav-item nav-item-active'
                  : 'nav-item'
              }
              type="button"
              onClick={() =>
                setWorkspaceMode(
                  'operations'
                )
              }
            >
              <Gauge size={18} />

              <span className="nav-copy">
                <strong>Operations</strong>
                <small>
                  Live command center
                </small>
              </span>

              {operationalSummary.attention >
              0 ? (
                <span className="nav-alert-count">
                  {
                    operationalSummary.attention
                  }
                </span>
              ) : null}
            </button>

            <button
              className={
                workspaceMode ===
                'archive'
                  ? 'nav-item nav-item-active'
                  : 'nav-item'
              }
              type="button"
              onClick={() =>
                setWorkspaceMode(
                  'archive'
                )
              }
            >
              <Archive size={18} />

              <span className="nav-copy">
                <strong>Archive</strong>
                <small>
                  Incident vault
                </small>
              </span>

              <span className="nav-count">
                {
                  incidentRecordsForView.length
                }
              </span>
            </button>

            <Link
              className="nav-item nav-item-tool"
              href="/sor-to-pdf"
            >
              <FileOutput
                size={18}
              />

              <span className="nav-copy">
                <strong>
                  SOR → PDF
                </strong>

                <small>
                  OTDR fiber lab
                </small>
              </span>

              <ChevronRight
                className="nav-chevron"
                size={15}
              />
            </Link>
          </nav>

          <div className="sidebar-spacer" />

          <div className="sidebar-status">
            <span className="status-orb" />

            <div className="sidebar-foot-copy">
              <strong>
                Local draft active
              </strong>

              <span>
                Autosaved on this device
              </span>
            </div>
          </div>
        </aside>

        <section className="main-stage">
          <header className="topbar">
            <div>
              <div className="eyebrow">
                <Sparkles size={13} />
                Incident workspace
              </div>

              <h1>
                {workspaceMode ===
                'operations'
                  ? 'Command center.'
                  : workspaceMode ===
                      'archive'
                    ? 'Incident vault.'
                    : 'Compose with clarity.'}
              </h1>

              {workspaceMode ===
                'compose' &&
              activeIncident ? (
                <div className="active-incident-context">
                  <span
                    data-status={
                      activeIncident.status
                    }
                  >
                    {
                      activeIncident.status
                    }
                  </span>

                  <span>
                    {
                      activeIncident.report
                        .ticket ||
                      'New incident'
                    }
                  </span>
                </div>
              ) : null}
            </div>

            <div className="topbar-actions">
              <button
                className="new-incident-button"
                type="button"
                onClick={
                  createNewIncident
                }
              >
                <FilePlus2
                  size={16}
                />
                New incident
              </button>

              <div className="save-chip">
                <span className="save-dot" />

                {hydrated
                  ? 'Draft synced locally'
                  : 'Opening workspace'}
              </div>

              <button
                className="icon-button"
                type="button"
                title="Load sample"
                onClick={resetToSample}
              >
                <RotateCcw size={17} />
              </button>
            </div>
          </header>

          {workspaceMode ===
          'operations' ? (
            <section className="operations-center">
              <div className="operations-hero glass-panel">
                <div className="operations-hero-copy">
                  <span className="operations-kicker">
                    OPERATIONAL PULSE
                  </span>

                  <h2>
                    Live incident
                    command center.
                  </h2>

                  <p>
                    Operational status is inferred
                    from each TT progress history.
                    Attention is raised after 60
                    minutes without a new update on
                    a running incident.
                  </p>

                  <div className="operations-hero-meta">
                    <span>
                      <span className="operations-live-dot" />
                      LIVE WORKSPACE
                    </span>

                    <span>
                      {
                        operationalSummary.totalActive
                      } active records
                    </span>
                  </div>
                </div>

                <div className="operations-orbit" aria-hidden="true">
                  <span className="operations-orbit-ring operations-orbit-ring-one" />
                  <span className="operations-orbit-ring operations-orbit-ring-two" />
                  <span className="operations-orbit-core">
                    <Activity
                      size={23}
                    />
                  </span>
                </div>
              </div>

              <div className="operations-kpi-grid">
                <article
                  className="operations-kpi glass-panel"
                  data-tone="running"
                >
                  <span className="operations-kpi-icon">
                    <Activity
                      size={16}
                    />
                  </span>

                  <div>
                    <span>
                      RUNNING TT
                    </span>

                    <strong>
                      {
                        operationalSummary.running
                      }
                    </strong>

                    <small>
                      Currently unresolved
                    </small>
                  </div>
                </article>

                <article
                  className="operations-kpi glass-panel"
                  data-tone="restored"
                >
                  <span className="operations-kpi-icon">
                    <Check
                      size={16}
                    />
                  </span>

                  <div>
                    <span>
                      RESTORED
                    </span>

                    <strong>
                      {
                        operationalSummary.restored
                      }
                    </strong>

                    <small>
                      {
                        operationalSummary.closurePending
                      } pending closure
                    </small>
                  </div>
                </article>

                <article
                  className="operations-kpi glass-panel"
                  data-tone={
                    operationalSummary.attention >
                    0
                      ? 'attention'
                      : 'clean'
                  }
                >
                  <span className="operations-kpi-icon">
                    <AlertTriangle
                      size={16}
                    />
                  </span>

                  <div>
                    <span>
                      NEED ATTENTION
                    </span>

                    <strong>
                      {
                        operationalSummary.attention
                      }
                    </strong>

                    <small>
                      60m+ without update
                    </small>
                  </div>
                </article>

                <article
                  className="operations-kpi glass-panel"
                  data-tone="aging"
                >
                  <span className="operations-kpi-icon">
                    <Clock3
                      size={16}
                    />
                  </span>

                  <div>
                    <span>
                      AVG RUNNING AGE
                    </span>

                    <strong>
                      {
                        formatOperationalDuration(
                          operationalSummary.averageRunningAgeMinutes
                        )
                      }
                    </strong>

                    <small>
                      Across running TT
                    </small>
                  </div>
                </article>
              </div>

              <section className="operations-board glass-panel">
                <div className="operations-board-head">
                  <div>
                    <span className="operations-board-kicker">
                      ACTIVE INCIDENTS
                    </span>

                    <h3>
                      Operational queue
                    </h3>

                    <p>
                      Highest-attention incidents
                      surface first automatically.
                    </p>
                  </div>

                  {operationalSummary.critical >
                  0 ? (
                    <span className="operations-critical-chip">
                      <AlertTriangle
                        size={13}
                      />
                      {
                        operationalSummary.critical
                      } critical freshness
                    </span>
                  ) : (
                    <span className="operations-healthy-chip">
                      <ShieldCheck
                        size={13}
                      />
                      No critical freshness
                    </span>
                  )}
                </div>

                <div className="operations-queue">
                  <AnimatePresence
                    initial={false}
                  >
                    {runningOperationalViews.map(
                      (item) => (
                        <motion.article
                          className="operations-incident-row"
                          data-status={
                            item.status
                          }
                          data-attention={
                            item.criticalAttention
                              ? 'critical'
                              : item.needsAttention
                                ? 'attention'
                                : 'normal'
                          }
                          key={
                            item.incidentId
                          }
                          layout
                          initial={{
                            opacity: 0,
                            y: 6,
                          }}
                          animate={{
                            opacity: 1,
                            y: 0,
                          }}
                          exit={{
                            opacity: 0,
                            scale: 0.99,
                          }}
                        >
                          <div className="operations-status-rail">
                            <span className="operations-status-dot" />
                            <span className="operations-status-line" />
                          </div>

                          <div className="operations-incident-identity">
                            <div className="operations-incident-tags">
                              <span className="operations-status-chip">
                                {
                                  operationalStatusLabel(
                                    item.status
                                  )
                                }
                              </span>

                              {item.closurePending ? (
                                <span className="operations-attention-chip operations-closure-chip">
                                  CLOSURE PENDING · {
                                    item.closureScore
                                  }%
                                </span>
                              ) : item.criticalAttention ? (
                                <span className="operations-attention-chip">
                                  CRITICAL FRESHNESS
                                </span>
                              ) : item.needsAttention ? (
                                <span className="operations-attention-chip">
                                  UPDATE DUE
                                </span>
                              ) : null}
                            </div>

                            <h4>
                              {
                                item.ticket ||
                                'Untitled incident'
                              }
                            </h4>

                            <p>
                              {
                                item.summary ||
                                'No incident summary yet.'
                              }
                            </p>

                            <div className="operations-incident-submeta">
                              <span>
                                {
                                  item.region ||
                                  'UNASSIGNED'
                                }
                              </span>

                              <span>
                                {
                                  item.pic ||
                                  'No PIC'
                                }
                              </span>
                            </div>
                          </div>

                          <div className="operations-incident-metrics">
                            <div>
                              <span>
                                AGE
                              </span>

                              <strong>
                                {
                                  formatOperationalDuration(
                                    item.ageMinutes
                                  )
                                }
                              </strong>
                            </div>

                            <div>
                              <span>
                                FRESHNESS
                              </span>

                              <strong>
                                {
                                  item.staleMinutes ===
                                  null
                                    ? '—'
                                    : formatOperationalDuration(
                                        item.staleMinutes
                                      ) + ' ago'
                                }
                              </strong>
                            </div>

                            <div>
                              <span>
                                UPDATES
                              </span>

                              <strong>
                                {
                                  item.progressCount
                                }
                              </strong>
                            </div>
                          </div>

                          <div className="operations-last-signal">
                            <span>
                              LAST SIGNAL
                            </span>

                            <strong>
                              {
                                item.lastActivityTime ||
                                '—'
                              }
                            </strong>

                            <p>
                              {
                                item.lastActivityText ||
                                'No progress update yet.'
                              }
                            </p>
                          </div>

                          <button
                            className="operations-open-button"
                            type="button"
                            onClick={() =>
                              openIncident(
                                item.incidentId
                              )
                            }
                          >
                            Open
                            <ChevronRight
                              size={14}
                            />
                          </button>
                        </motion.article>
                      )
                    )}
                  </AnimatePresence>

                  {runningOperationalViews.length ===
                  0 ? (
                    <div className="operations-empty">
                      <Check
                        size={25}
                      />

                      <strong>
                        No active incident
                        records
                      </strong>

                      <span>
                        Create a new incident
                        or restore one from
                        the vault.
                      </span>
                    </div>
                  ) : null}
                </div>
              </section>
            </section>
          ) : workspaceMode ===
          'archive' ? (
            <section className="incident-vault">
              <div className="vault-hero glass-panel">
                <div className="vault-hero-copy">
                  <span className="vault-kicker">
                    INCIDENT MEMORY
                  </span>

                  <h2>
                    Every TT, one
                    operational memory.
                  </h2>

                  <p>
                    Search, reopen, archive,
                    and continue any incident
                    without sacrificing the
                    draft currently in your
                    composer.
                  </p>
                </div>

                <div className="vault-stat-grid">
                  <div>
                    <span>
                      TOTAL
                    </span>
                    <strong>
                      {
                        incidentRecordsForView
                          .length
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      ACTIVE
                    </span>
                    <strong>
                      {
                        activeIncidentCount
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      ARCHIVED
                    </span>
                    <strong>
                      {
                        archivedIncidentCount
                      }
                    </strong>
                  </div>
                </div>
              </div>

              <div className="vault-toolbar glass-panel">
                <label className="vault-search">
                  <Search size={15} />

                  <input
                    value={
                      archiveQuery
                    }
                    placeholder="Search TT, region, PIC, rootcause, progress..."
                    onChange={(
                      event
                    ) =>
                      setArchiveQuery(
                        event.target
                          .value
                      )
                    }
                  />

                  {archiveQuery ? (
                    <button
                      type="button"
                      title="Clear search"
                      onClick={() =>
                        setArchiveQuery(
                          ''
                        )
                      }
                    >
                      <X size={14} />
                    </button>
                  ) : null}
                </label>

                <button
                  className="vault-create-button"
                  type="button"
                  onClick={
                    createNewIncident
                  }
                >
                  <FilePlus2
                    size={15}
                  />
                  Create incident
                </button>
              </div>

              <div className="vault-list">
                <AnimatePresence
                  initial={false}
                >
                  {filteredIncidents.map(
                    (incident) => {
                      const isCurrent =
                        incident.id ===
                        activeIncidentId;

                      const reportItem =
                        incident.report;

                      return (
                        <motion.article
                          className="vault-incident-card glass-panel"
                          data-current={
                            isCurrent
                              ? 'true'
                              : 'false'
                          }
                          data-status={
                            incident.status
                          }
                          key={
                            incident.id
                          }
                          layout
                          initial={{
                            opacity: 0,
                            y: 8,
                          }}
                          animate={{
                            opacity: 1,
                            y: 0,
                          }}
                          exit={{
                            opacity: 0,
                            scale: 0.98,
                          }}
                        >
                          <div className="vault-card-status">
                            <span
                              className="vault-status-dot"
                              aria-hidden="true"
                            />

                            <span>
                              {
                                incident.status
                              }
                            </span>

                            {isCurrent ? (
                              <span className="vault-current-chip">
                                OPEN NOW
                              </span>
                            ) : null}
                          </div>

                          <div className="vault-card-main">
                            <div className="vault-card-identity">
                              <span className="vault-region">
                                {
                                  reportItem.region ||
                                  'UNASSIGNED'
                                }
                              </span>

                              <h3>
                                {
                                  reportItem.ticket ||
                                  'Untitled incident'
                                }
                              </h3>

                              <p>
                                {
                                  reportItem.summary ||
                                  'No incident summary yet.'
                                }
                              </p>
                            </div>

                            <div className="vault-card-metrics">
                              <div>
                                <span>
                                  READY
                                </span>
                                <strong>
                                  {
                                    completionScore(
                                      reportItem
                                    )
                                  }
                                  %
                                </strong>
                              </div>

                              <div>
                                <span>
                                  UPDATES
                                </span>
                                <strong>
                                  {
                                    reportItem.progress
                                      .length
                                  }
                                </strong>
                              </div>
                            </div>
                          </div>

                          <div className="vault-card-footer">
                            <div className="vault-card-meta">
                              <span>
                                {
                                  reportItem.pic ||
                                  'No PIC'
                                }
                              </span>

                              <span>
                                Updated {
                                  isCurrent
                                    ? 'now'
                                    : formatIncidentTimestamp(
                                        incident.updatedAt
                                      )
                                }
                              </span>
                            </div>

                            <div className="vault-card-actions">
                              <button
                                className="vault-secondary-action"
                                type="button"
                                onClick={() =>
                                  toggleIncidentArchive(
                                    incident.id
                                  )
                                }
                              >
                                {incident.status ===
                                'archived' ? (
                                  <ArchiveRestore
                                    size={14}
                                  />
                                ) : (
                                  <FolderArchive
                                    size={14}
                                  />
                                )}

                                {incident.status ===
                                'archived'
                                  ? 'Restore'
                                  : 'Archive'}
                              </button>

                              <button
                                className="vault-open-action"
                                type="button"
                                onClick={() =>
                                  openIncident(
                                    incident.id
                                  )
                                }
                              >
                                {isCurrent
                                  ? 'Return to composer'
                                  : 'Open incident'}

                                <ChevronRight
                                  size={14}
                                />
                              </button>
                            </div>
                          </div>
                        </motion.article>
                      );
                    }
                  )}
                </AnimatePresence>

                {filteredIncidents.length ===
                0 ? (
                  <div className="vault-empty glass-panel">
                    <FolderArchive
                      size={24}
                    />

                    <strong>
                      No incidents found
                    </strong>

                    <span>
                      Try another search or
                      create a fresh incident.
                    </span>
                  </div>
                ) : null}
              </div>
            </section>
          ) : (
            <>
          <div
            className="mobile-pane-switcher glass-panel"
            role="tablist"
            aria-label="Workspace view"
          >
            <button
              className={
                mobilePane === 'compose'
                  ? 'pane-tab pane-tab-active'
                  : 'pane-tab'
              }
              type="button"
              role="tab"
              aria-selected={
                mobilePane === 'compose'
              }
              onClick={() =>
                setMobilePane('compose')
              }
            >
              <Layers3 size={15} />
              Composer
            </button>

            <button
              className={
                mobilePane === 'preview'
                  ? 'pane-tab pane-tab-active'
                  : 'pane-tab'
              }
              type="button"
              role="tab"
              aria-selected={
                mobilePane === 'preview'
              }
              onClick={() =>
                setMobilePane('preview')
              }
            >
              <FileText size={15} />
              Preview
            </button>
          </div>

          <div className="workspace-grid">
            <section
              className="composer-column"
              data-mobile-hidden={
                mobilePane !== 'compose'
              }
            >
              <motion.section
                className="smart-import-card glass-panel"
                layout
              >
                <div className="smart-import-head">
                  <div className="smart-import-title">
                    <div className="smart-import-icon">
                      <WandSparkles
                        size={18}
                      />
                    </div>

                    <div>
                      <div className="smart-import-kicker">
                        SMART INGEST
                      </div>

                      <h2>
                        Paste. Parse. Done.
                      </h2>

                      <p>
                        Drop a raw incident bagan here.
                        ReportOS will reconstruct its
                        structured fields and timeline.
                      </p>
                    </div>
                  </div>

                  <span className="smart-import-badge">
                    F1 PARSER
                  </span>
                </div>

                <div className="smart-import-body">
                  <label className="smart-import-editor">
                    <span className="smart-import-editor-label">
                      <span>
                        RAW INCIDENT PAYLOAD
                      </span>

                      <span>
                        {
                          rawImport.length
                        } chars
                      </span>
                    </span>

                    <textarea
                      value={rawImport}
                      spellCheck={false}
                      placeholder="Paste the complete incident report here — formatting can be messy."
                      onChange={(event) => {
                        setRawImport(
                          event.target.value
                        );

                        setImportFeedback(
                          null
                        );
                      }}
                    />
                  </label>

                  <div className="smart-import-actions">
                    <button
                      className="clipboard-import-button"
                      type="button"
                      onClick={
                        pasteFromClipboard
                      }
                    >
                      <Clipboard
                        size={16}
                      />

                      Read clipboard
                    </button>

                    <button
                      className="smart-parse-button"
                      type="button"
                      disabled={
                        !rawImport.trim()
                      }
                      onClick={
                        applySmartImport
                      }
                    >
                      <Sparkles
                        size={16}
                      />

                      Smart Parse & Apply

                      <ChevronRight
                        size={15}
                      />
                    </button>
                  </div>

                  <AnimatePresence
                    mode="popLayout"
                  >
                    {importFeedback ? (
                      <motion.div
                        key={
                          importFeedback.title +
                          importFeedback.detail
                        }
                        className="import-feedback"
                        data-tone={
                          importFeedback.tone
                        }
                        initial={{
                          opacity: 0,
                          y: -4,
                        }}
                        animate={{
                          opacity: 1,
                          y: 0,
                        }}
                        exit={{
                          opacity: 0,
                          y: -4,
                        }}
                        role="status"
                        aria-live="polite"
                      >
                        <span className="import-feedback-indicator">
                          {importFeedback.tone ===
                          'success' ? (
                            <Check
                              size={13}
                            />
                          ) : (
                            <FileText
                              size={13}
                            />
                          )}
                        </span>

                        <div>
                          <strong>
                            {
                              importFeedback.title
                            }
                          </strong>

                          <span>
                            {
                              importFeedback.detail
                            }
                          </span>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </motion.section>

              <motion.div
                className="hero-card glass-panel"
                layout
              >
                <div className="hero-card-copy">
                  <span className="hero-kicker">
                    LIVE INCIDENT / DRAFT
                  </span>

                  <h2>
                    {report.region ||
                      'Untitled incident'}
                  </h2>

                  <p>
                    {report.summary ||
                      'Start filling the incident detail to build your structured operational report.'}
                  </p>
                </div>

                <div
                  className="health-ring"
                  style={
                    {
                      '--score': String(score),
                    } as React.CSSProperties
                  }
                >
                  <div className="health-ring-inner">
                    <strong>
                      {score}%
                    </strong>

                    <span>ready</span>
                  </div>
                </div>
              </motion.div>

              <section className="section-card glass-panel">
                <div className="section-heading">
                  <div className="section-icon section-icon-violet">
                    <Command size={17} />
                  </div>

                  <div>
                    <span className="section-index">
                      01
                    </span>

                    <h3>
                      Incident identity
                    </h3>

                    <p>
                      Core identifiers that
                      anchor the report.
                    </p>
                  </div>
                </div>

                <div className="field-grid">
                  <Field
                    label="Region"
                    value={report.region}
                    placeholder="MANDAU"
                    onChange={(value) =>
                      updateField(
                        'region',
                        value
                      )
                    }
                  />

                  <Field
                    label="Trouble ticket"
                    value={report.ticket}
                    placeholder="INC-YYYYMMDD-00000000"
                    onChange={(value) =>
                      updateField(
                        'ticket',
                        value
                      )
                    }
                  />

                  <Field
                    label="Alarm / link summary"
                    value={report.summary}
                    placeholder="LINK DOWN AT ... <> ..."
                    wide
                    multiline
                    onChange={(value) =>
                      updateField(
                        'summary',
                        value
                      )
                    }
                  />
                </div>
              </section>

              <section className="section-card glass-panel dispatch-context-card">
                <div className="section-heading">
                  <div className="section-icon section-icon-blue">
                    <Clock3 size={17} />
                  </div>

                  <div>
                    <span className="section-index">
                      02
                    </span>

                    <h3>
                      Dispatch context
                    </h3>

                    <p>
                      Timing, ownership, link
                      impact, and physical cut
                      point topology.
                    </p>
                  </div>

                  <div className="dispatch-topology-summary">
                    <span>
                      {
                        (
                          report.impactLinks ??
                          []
                        ).length
                      } impact
                    </span>

                    <span>
                      {
                        (
                          report.cutPoints ??
                          []
                        ).length
                      } CP
                    </span>
                  </div>
                </div>

                <div className="field-grid dispatch-core-grid">
                  <Field
                    label="Occur time"
                    hint="DD/MM/YYYY HH:mm"
                    value={
                      report.occurTime
                    }
                    placeholder="15/08/2026 13:54"
                    onChange={(value) =>
                      updateField(
                        'occurTime',
                        value
                      )
                    }
                  />

                  <Field
                    label="Dispatch time"
                    hint="DD/MM/YYYY HH:mm"
                    value={
                      report.dispatchTime
                    }
                    placeholder="15/08/2026 14:25"
                    onChange={(value) =>
                      updateField(
                        'dispatchTime',
                        value
                      )
                    }
                  />

                  <Field
                    label="PIC"
                    value={report.pic}
                    placeholder="Name (area)"
                    wide
                    onChange={(value) =>
                      updateField(
                        'pic',
                        value
                      )
                    }
                  />
                </div>

                <div className="dispatch-topology">
                  <section className="dispatch-topology-block">
                    <div className="dispatch-subheading">
                      <div>
                        <span className="dispatch-subheading-icon">
                          <Link2
                            size={15}
                          />
                        </span>

                        <div>
                          <strong>
                            Link impact topology
                          </strong>

                          <small>
                            Freeform affected links.
                            Region, status tag, and
                            child TT are optional.
                          </small>
                        </div>
                      </div>

                      <button
                        className="dispatch-add-button"
                        type="button"
                        onClick={
                          addImpactLink
                        }
                      >
                        <Plus
                          size={14}
                        />
                        Impact link
                      </button>
                    </div>

                    <article className="primary-link-editor">
                      <div className="topology-card-head">
                        <div>
                          <span className="topology-index">
                            MAIN LINK
                          </span>

                          <strong>
                            {
                              report.ticket ||
                              'Primary incident'
                            }
                          </strong>
                        </div>

                        <MarkerSelector
                          compact
                          value={
                            report.primaryMarker
                          }
                          onChange={
                            updatePrimaryMarker
                          }
                        />
                      </div>

                      <div className="primary-link-grid">
                        <label>
                          <span>
                            STATUS TAG
                          </span>

                          <input
                            value={
                              report.statusTag ??
                              ''
                            }
                            placeholder="[Open - Major]"
                            onChange={(
                              event
                            ) =>
                              updatePrimaryStatusTag(
                                event.target
                                  .value
                              )
                            }
                          />
                        </label>

                        <div className="primary-link-readonly">
                          <span>
                            LINK / ALARM
                          </span>

                          <strong>
                            {
                              report.summary ||
                              'Use Incident Identity to define the main link.'
                            }
                          </strong>
                        </div>
                      </div>
                    </article>

                    <div className="impact-link-list">
                      <AnimatePresence
                        initial={false}
                      >
                        {(
                          report.impactLinks ??
                          []
                        ).map(
                          (
                            impact,
                            index
                          ) => (
                            <motion.article
                              className="impact-link-editor"
                              data-marker={
                                impact.marker
                              }
                              key={
                                impact.id
                              }
                              layout
                              initial={{
                                opacity: 0,
                                y: 6,
                              }}
                              animate={{
                                opacity: 1,
                                y: 0,
                              }}
                              exit={{
                                opacity: 0,
                                scale: 0.98,
                              }}
                            >
                              <div className="topology-card-head">
                                <div>
                                  <span className="topology-index">
                                    IMPACT {
                                      index + 1
                                    }
                                  </span>

                                  <strong>
                                    {
                                      impact.ticket ||
                                      'Untitled impact TT'
                                    }
                                  </strong>
                                </div>

                                <div className="topology-head-actions">
                                  <MarkerSelector
                                    compact
                                    value={
                                      impact.marker
                                    }
                                    onChange={(
                                      marker
                                    ) =>
                                      updateImpactLink(
                                        impact.id,
                                        'marker',
                                        marker
                                      )
                                    }
                                  />

                                  <button
                                    className="topology-delete-button"
                                    type="button"
                                    title="Remove impact link"
                                    onClick={() =>
                                      removeImpactLink(
                                        impact.id
                                      )
                                    }
                                  >
                                    <Trash2
                                      size={13}
                                    />
                                  </button>
                                </div>
                              </div>

                              <div className="impact-link-grid">
                                <label>
                                  <span>
                                    REGION · OPTIONAL
                                  </span>

                                  <input
                                    value={
                                      impact.region
                                    }
                                    placeholder="FLP_3rd_MANDAU"
                                    onChange={(
                                      event
                                    ) =>
                                      updateImpactLink(
                                        impact.id,
                                        'region',
                                        event.target
                                          .value
                                      )
                                    }
                                  />
                                </label>

                                <label>
                                  <span>
                                    STATUS TAG · OPTIONAL
                                  </span>

                                  <input
                                    value={
                                      impact.statusTag
                                    }
                                    placeholder="[Open - Major]"
                                    onChange={(
                                      event
                                    ) =>
                                      updateImpactLink(
                                        impact.id,
                                        'statusTag',
                                        event.target
                                          .value
                                      )
                                    }
                                  />
                                </label>

                                <label className="topology-field-wide">
                                  <span>
                                    IMPACT HEADLINE / LINK
                                  </span>

                                  <textarea
                                    rows={2}
                                    value={
                                      impact.summary
                                    }
                                    placeholder="Freeform: DOWN - A<>B / Degrade backbone / affected service..."
                                    onChange={(
                                      event
                                    ) =>
                                      updateImpactLink(
                                        impact.id,
                                        'summary',
                                        event.target
                                          .value
                                      )
                                    }
                                  />
                                </label>

                                <label className="topology-field-wide">
                                  <span>
                                    IMPACT TROUBLE TICKET · OPTIONAL
                                  </span>

                                  <input
                                    value={
                                      impact.ticket
                                    }
                                    placeholder="DATACOM-INC-YYYYMMDD-00000000"
                                    onChange={(
                                      event
                                    ) =>
                                      updateImpactLink(
                                        impact.id,
                                        'ticket',
                                        event.target
                                          .value
                                      )
                                    }
                                  />
                                </label>
                              </div>
                            </motion.article>
                          )
                        )}
                      </AnimatePresence>

                      {(
                        report.impactLinks ??
                        []
                      ).length === 0 ? (
                        <div className="topology-empty-state">
                          <Link2
                            size={18}
                          />

                          <div>
                            <strong>
                              No impact link
                            </strong>

                            <span>
                              Add any affected link
                              in whatever operational
                              format you receive.
                              Structured metadata is
                              optional.
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </section>

                  <section className="dispatch-topology-block">
                    <div className="dispatch-subheading">
                      <div>
                        <span className="dispatch-subheading-icon dispatch-subheading-icon-cp">
                          <MapPin
                            size={15}
                          />
                        </span>

                        <div>
                          <strong>
                            Cut point topology
                          </strong>

                          <small>
                            Pair each CP with its
                            own rootcause, location,
                            and current marker.
                          </small>
                        </div>
                      </div>

                      <button
                        className="dispatch-add-button"
                        type="button"
                        onClick={
                          addCutPoint
                        }
                      >
                        <Plus
                          size={14}
                        />
                        Add CP
                      </button>
                    </div>

                    {(
                      report.cutPoints ??
                      []
                    ).length === 0 ? (
                      <div className="legacy-cp-editor">
                        <div className="legacy-cp-note">
                          <MapPin
                            size={15}
                          />

                          <div>
                            <strong>
                              Single CP mode
                            </strong>

                            <span>
                              These legacy fields
                              remain ideal for a
                              normal one-cut
                              incident. Press Add
                              CP to promote them
                              into structured CP1.
                            </span>
                          </div>
                        </div>

                        <div className="field-grid">
                          <Field
                            label="Cut point"
                            value={
                              report.cutPoint
                            }
                            placeholder="KM / landmark / location"
                            onChange={(value) =>
                              updateField(
                                'cutPoint',
                                value
                              )
                            }
                          />

                          <Field
                            label="Rootcause"
                            value={
                              report.rootcause
                            }
                            placeholder="Describe root cause"
                            wide
                            multiline
                            onChange={(value) =>
                              updateField(
                                'rootcause',
                                value
                              )
                            }
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="cut-point-list">
                        <AnimatePresence
                          initial={false}
                        >
                          {(
                            report.cutPoints ??
                            []
                          ).map(
                            (
                              cp,
                              index
                            ) => (
                              <motion.article
                                className="cut-point-editor"
                                data-marker={
                                  cp.marker
                                }
                                key={
                                  cp.id
                                }
                                layout
                                initial={{
                                  opacity: 0,
                                  y: 6,
                                }}
                                animate={{
                                  opacity: 1,
                                  y: 0,
                                }}
                                exit={{
                                  opacity: 0,
                                  scale: 0.98,
                                }}
                              >
                                <div className="topology-card-head">
                                  <label className="cp-label-editor">
                                    <span>
                                      CP LABEL
                                    </span>

                                    <input
                                      value={
                                        cp.label
                                      }
                                      aria-label={
                                        'Cut point label ' +
                                        (
                                          index +
                                          1
                                        )
                                      }
                                      onChange={(
                                        event
                                      ) =>
                                        updateCutPoint(
                                          cp.id,
                                          'label',
                                          event.target
                                            .value
                                        )
                                      }
                                    />
                                  </label>

                                  <div className="topology-head-actions">
                                    <MarkerSelector
                                      compact
                                      value={
                                        cp.marker
                                      }
                                      onChange={(
                                        marker
                                      ) =>
                                        updateCutPoint(
                                          cp.id,
                                          'marker',
                                          marker
                                        )
                                      }
                                    />

                                    <button
                                      className="topology-delete-button"
                                      type="button"
                                      title="Remove cut point"
                                      onClick={() =>
                                        removeCutPoint(
                                          cp.id
                                        )
                                      }
                                    >
                                      <Trash2
                                        size={13}
                                      />
                                    </button>
                                  </div>
                                </div>

                                <div className="cut-point-grid">
                                  <label>
                                    <span>
                                      ROOTCAUSE
                                    </span>

                                    <textarea
                                      rows={2}
                                      value={
                                        cp.rootcause
                                      }
                                      placeholder="Impact Activity Drainage Project"
                                      onChange={(
                                        event
                                      ) =>
                                        updateCutPoint(
                                          cp.id,
                                          'rootcause',
                                          event.target
                                            .value
                                        )
                                      }
                                    />
                                  </label>

                                  <label>
                                    <span>
                                      CUT POINT
                                    </span>

                                    <textarea
                                      rows={2}
                                      value={
                                        cp.cutPoint
                                      }
                                      placeholder="KM 7,9 from GRIYAAGUNG"
                                      onChange={(
                                        event
                                      ) =>
                                        updateCutPoint(
                                          cp.id,
                                          'cutPoint',
                                          event.target
                                            .value
                                        )
                                      }
                                    />
                                  </label>
                                </div>
                              </motion.article>
                            )
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {(
                      report.cutPoints ??
                      []
                    ).length > 0 ? (
                      <div className="topology-sync-note">
                        <ShieldCheck
                          size={13}
                        />

                        <span>
                          Structured CP values
                          automatically sync to
                          the legacy Rootcause /
                          Cut Point report fields.
                        </span>
                      </div>
                    ) : null}
                  </section>
                </div>
              </section>

              <section className="section-card glass-panel timeline-card">
                <div className="section-heading timeline-heading">
                  <div className="section-icon section-icon-emerald">
                    <Activity size={17} />
                  </div>

                  <div>
                    <span className="section-index">
                      03
                    </span>

                    <h3>
                      Update progress
                    </h3>

                    <p>
                      Chronological worklog.
                      New updates land
                      instantly in the
                      preview.
                    </p>
                  </div>

                  <span className="update-count">
                    {report.progress.length}{' '}
                    updates
                  </span>
                </div>

                <div className="progress-assistant-panel">
                  <div className="progress-assistant-head">
                    <div>
                      <span className="progress-assistant-icon">
                        <Sparkles
                          size={15}
                        />
                      </span>

                      <div>
                        <strong>
                          Periodic update assistant
                        </strong>

                        <span>
                          Suggested next signals
                          follow the current
                          operational stage.
                          Clicking one records it
                          with the current date
                          and time.
                        </span>
                      </div>
                    </div>

                    <span className="progress-stage-chip">
                      {
                        operationalStatusLabel(
                          activeProgressStatus
                        )
                      }
                    </span>
                  </div>

                  <div className="progress-suggestion-row">
                    {suggestedProgressMacros.map(
                      (macro) => (
                        <button
                          className="progress-suggestion-button"
                          data-kind={
                            macro.kind
                          }
                          key={
                            macro.id
                          }
                          type="button"
                          title={
                            'Add now: ' +
                            macro.text
                          }
                          onClick={() =>
                            addProgressMacro(
                              macro
                            )
                          }
                        >
                          <Plus
                            size={12}
                          />
                          {
                            macro.label
                          }
                        </button>
                      )
                    )}
                  </div>

                  <details className="progress-macro-library">
                    <summary>
                      More quick updates
                      <ChevronRight
                        size={13}
                      />
                    </summary>

                    <div>
                      {PROGRESS_MACROS.map(
                        (macro) => (
                          <button
                            data-kind={
                              macro.kind
                            }
                            key={
                              macro.id
                            }
                            type="button"
                            title={
                              macro.text
                            }
                            onClick={() =>
                              addProgressMacro(
                                macro
                              )
                            }
                          >
                            {
                              macro.label
                            }
                          </button>
                        )
                      )}
                    </div>
                  </details>
                </div>

                <div className="quick-add quick-add-f10">
                  <label className="quick-date">
                    <span>DATE</span>

                    <input
                      type="date"
                      value={
                        progressDateToInput(
                          entryDate
                        )
                      }
                      onChange={(event) =>
                        setEntryDate(
                          progressDateFromInput(
                            event.target.value
                          )
                        )
                      }
                    />
                  </label>

                  <label className="quick-time">
                    <span>TIME</span>

                    <input
                      value={entryTime}
                      placeholder="22:15"
                      onChange={(event) =>
                        setEntryTime(
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label className="quick-text">
                    <span>
                      PROGRESS UPDATE
                    </span>

                    <input
                      value={entryText}
                      placeholder="Type the latest activity..."
                      onChange={(event) =>
                        setEntryText(
                          event.target.value
                        )
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key ===
                            'Enter' &&
                          (event.ctrlKey ||
                            event.metaKey)
                        ) {
                          addProgress();
                        }
                      }}
                    />
                  </label>

                  <button
                    className="progress-now-button"
                    type="button"
                    title="Use current date and time"
                    onClick={
                      setComposerTimestampNow
                    }
                  >
                    <Clock3
                      size={14}
                    />
                    Now
                  </button>

                  <button
                    className="add-button"
                    type="button"
                    onClick={addProgress}
                    disabled={
                      !entryDate.trim() ||
                      !entryTime.trim() ||
                      !entryText.trim()
                    }
                  >
                    <Plus size={17} />
                    Add update
                  </button>
                </div>

                <div className="timeline-intelligence-bar">
                  <div className="timeline-intelligence-copy">
                    <span className="timeline-intelligence-icon">
                      <Activity
                        size={14}
                      />
                    </span>

                    <div>
                      <strong>
                        Timeline intelligence
                      </strong>

                      <span>
                        Entries now keep an
                        internal calendar date,
                        so multi-day incidents
                        sort correctly. The
                        generated bagan still
                        prints HH:mm only.
                      </span>
                    </div>
                  </div>

                  <div className="timeline-intelligence-actions">
                    {duplicateTimes.size >
                    0 ? (
                      <span className="duplicate-time-alert">
                        <AlertTriangle
                          size={13}
                        />

                        {
                          duplicateTimes.size
                        } duplicate time
                        {duplicateTimes.size >
                        1
                          ? 's'
                          : ''}
                      </span>
                    ) : (
                      <span className="timeline-clean-chip">
                        <Check
                          size={12}
                        />
                        Timeline clean
                      </span>
                    )}

                    <button
                      className="timeline-sort-button"
                      type="button"
                      disabled={
                        report.progress
                          .length < 2
                      }
                      onClick={
                        sortTimeline
                      }
                    >
                      <ArrowUpDown
                        size={14}
                      />
                      Sort timeline
                    </button>
                  </div>
                </div>

                <div className="timeline-list">
                  <AnimatePresence
                    initial={false}
                  >
                    {report.progress.map(
                      (entry, index) => {
                        const kind =
                          detectProgressKind(
                            entry.text
                          );

                        const isEditing =
                          editingProgressId ===
                          entry.id;

                        const isDuplicate =
                          duplicateTimes.has(
                            progressDuplicateKey(
                              entry
                            )
                          );

                        return (
                          <motion.div
                            className="timeline-row timeline-row-f2"
                            data-kind={
                              kind
                            }
                            data-duplicate={
                              isDuplicate
                                ? 'true'
                                : 'false'
                            }
                            key={entry.id}
                            layout
                            initial={{
                              opacity: 0,
                              y: 8,
                            }}
                            animate={{
                              opacity: 1,
                              y: 0,
                            }}
                            exit={{
                              opacity: 0,
                              scale: 0.98,
                            }}
                          >
                            <div
                              className="timeline-rail"
                              aria-hidden="true"
                            >
                              <span className="timeline-node">
                                {String(
                                  index + 1
                                ).padStart(
                                  2,
                                  '0'
                                )}
                              </span>

                              {index <
                              report.progress
                                .length -
                                1 ? (
                                <span className="timeline-line" />
                              ) : null}
                            </div>

                            {isEditing ? (
                              <div className="timeline-edit-moment">
                                <label>
                                  <span>
                                    DATE
                                  </span>

                                  <input
                                    type="date"
                                    value={
                                      progressDateToInput(
                                        editingProgressDate
                                      )
                                    }
                                    aria-label="Edit progress date"
                                    onChange={(
                                      event
                                    ) =>
                                      setEditingProgressDate(
                                        progressDateFromInput(
                                          event.target.value
                                        )
                                      )
                                    }
                                  />
                                </label>

                                <label>
                                  <span>
                                    TIME
                                  </span>

                                  <input
                                    value={
                                      editingProgressTime
                                    }
                                    aria-label="Edit progress time"
                                    onChange={(
                                      event
                                    ) =>
                                      setEditingProgressTime(
                                        event
                                          .target
                                          .value
                                      )
                                    }
                                  />
                                </label>
                              </div>
                            ) : (
                              <div className="timeline-time timeline-moment">
                                <strong>
                                  {
                                    entry.time
                                  }
                                </strong>

                                {entry.date ? (
                                  <small>
                                    {
                                      entry.date
                                    }
                                  </small>
                                ) : (
                                  <small>
                                    legacy date
                                  </small>
                                )}

                                {isDuplicate ? (
                                  <span
                                    className="duplicate-dot"
                                    title="Duplicate timeline moment"
                                  />
                                ) : null}
                              </div>
                            )}

                            <div className="timeline-entry-main">
                              <div className="timeline-entry-meta">
                                <span
                                  className="timeline-kind-chip"
                                  data-kind={
                                    kind
                                  }
                                >
                                  {
                                    PROGRESS_KIND_LABELS[
                                      kind
                                    ]
                                  }
                                </span>

                                {isDuplicate ? (
                                  <span className="timeline-duplicate-label">
                                    Same time detected
                                  </span>
                                ) : null}
                              </div>

                              {isEditing ? (
                                <textarea
                                  className="timeline-edit-text"
                                  value={
                                    editingProgressText
                                  }
                                  aria-label="Edit progress text"
                                  rows={2}
                                  onChange={(
                                    event
                                  ) =>
                                    setEditingProgressText(
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                  onKeyDown={(
                                    event
                                  ) => {
                                    if (
                                      event.key ===
                                        'Enter' &&
                                      (event.ctrlKey ||
                                        event.metaKey)
                                    ) {
                                      saveEditProgress();
                                    }

                                    if (
                                      event.key ===
                                      'Escape'
                                    ) {
                                      cancelEditProgress();
                                    }
                                  }}
                                />
                              ) : (
                                <p>
                                  {
                                    entry.text
                                  }
                                </p>
                              )}
                            </div>

                            <div className="timeline-row-actions">
                              {isEditing ? (
                                <>
                                  <button
                                    className="timeline-action timeline-action-save"
                                    type="button"
                                    title="Save update"
                                    disabled={
                                      !editingProgressDate.trim() ||
                                      !editingProgressTime.trim() ||
                                      !editingProgressText.trim()
                                    }
                                    onClick={
                                      saveEditProgress
                                    }
                                  >
                                    <Check
                                      size={14}
                                    />
                                  </button>

                                  <button
                                    className="timeline-action"
                                    type="button"
                                    title="Cancel edit"
                                    onClick={
                                      cancelEditProgress
                                    }
                                  >
                                    <X
                                      size={14}
                                    />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    className="timeline-action"
                                    type="button"
                                    title="Edit update"
                                    onClick={() =>
                                      beginEditProgress(
                                        entry
                                      )
                                    }
                                  >
                                    <Pencil
                                      size={13}
                                    />
                                  </button>

                                  <button
                                    className="timeline-action"
                                    type="button"
                                    title="Move update up"
                                    disabled={
                                      index === 0
                                    }
                                    onClick={() =>
                                      moveProgress(
                                        entry.id,
                                        -1
                                      )
                                    }
                                  >
                                    <ArrowUp
                                      size={13}
                                    />
                                  </button>

                                  <button
                                    className="timeline-action"
                                    type="button"
                                    title="Move update down"
                                    disabled={
                                      index ===
                                      report.progress
                                        .length -
                                        1
                                    }
                                    onClick={() =>
                                      moveProgress(
                                        entry.id,
                                        1
                                      )
                                    }
                                  >
                                    <ArrowDown
                                      size={13}
                                    />
                                  </button>

                                  <button
                                    className="timeline-action timeline-action-delete"
                                    type="button"
                                    title="Delete update"
                                    onClick={() =>
                                      removeProgress(
                                        entry.id
                                      )
                                    }
                                  >
                                    <Trash2
                                      size={13}
                                    />
                                  </button>
                                </>
                              )}
                            </div>
                          </motion.div>
                        );
                      }
                    )}
                  </AnimatePresence>

                  {report.progress.length ===
                  0 ? (
                    <div className="empty-timeline">
                      <Activity size={20} />

                      <strong>
                        No progress update yet
                      </strong>

                      <span>
                        Add the first field
                        activity above.
                      </span>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="section-card glass-panel closure-readiness-card">
                <div className="section-heading closure-heading">
                  <div className="section-icon closure-section-icon">
                    <ShieldCheck
                      size={17}
                    />
                  </div>

                  <div>
                    <span className="section-index">
                      04
                    </span>

                    <h3>
                      Closure readiness
                    </h3>

                    <p>
                      Administrative tasks that
                      must follow operational
                      restoration.
                    </p>
                  </div>

                  <div
                    className="closure-score"
                    data-complete={
                      activeClosureComplete
                        ? 'true'
                        : 'false'
                    }
                  >
                    <strong>
                      {
                        activeClosureScore
                      }%
                    </strong>

                    <span>
                      {
                        activeClosureCompleted
                      }/{CLOSURE_ATOMIC_TASK_COUNT}
                    </span>
                  </div>
                </div>

                {activeOperationalView?.status ===
                  'restored' &&
                !activeClosureComplete ? (
                  <div className="closure-warning">
                    <AlertTriangle
                      size={15}
                    />

                    <div>
                      <strong>
                        Link restored · closure
                        administration incomplete
                      </strong>

                      <span>
                        ReportOS will keep this
                        incident visible as
                        Closure Pending until
                        every task below is done.
                      </span>
                    </div>
                  </div>
                ) : activeClosureComplete ? (
                  <div className="closure-ready-banner">
                    <Check
                      size={15}
                    />

                    <div>
                      <strong>
                        Administrative closure
                        complete
                      </strong>

                      <span>
                        All five atomic closure
                        tasks are finished.
                      </span>
                    </div>
                  </div>
                ) : null}

                <div className="closure-checklist">
                  <button
                    className="closure-task"
                    data-checked={
                      activeClosureChecklist.statementUpWag
                        ? 'true'
                        : 'false'
                    }
                    type="button"
                    onClick={() =>
                      toggleClosureTask(
                        'statementUpWag'
                      )
                    }
                  >
                    <span className="closure-checkbox">
                      {activeClosureChecklist.statementUpWag ? (
                        <Check
                          size={13}
                        />
                      ) : null}
                    </span>

                    <span className="closure-task-copy">
                      <strong>
                        Statement Up WAG
                      </strong>

                      <small>
                        Confirm restoration
                        statement has been
                        delivered to WAG.
                      </small>
                    </span>

                    <span className="closure-task-state">
                      {activeClosureChecklist.statementUpWag
                        ? 'DONE'
                        : 'PENDING'}
                    </span>
                  </button>

                  <div
                    className="closure-group"
                    data-complete={
                      activeMatoaComplete
                        ? 'true'
                        : 'false'
                    }
                  >
                    <div className="closure-group-head">
                      <span className="closure-checkbox closure-checkbox-parent">
                        {activeMatoaComplete ? (
                          <Check
                            size={13}
                          />
                        ) : (
                          <span>
                            {
                              activeMatoaCompleted
                            }/3
                          </span>
                        )}
                      </span>

                      <span className="closure-task-copy">
                        <strong>
                          Matoa Clearance
                        </strong>

                        <small>
                          Three supporting
                          clearance requirements.
                        </small>
                      </span>

                      <span className="closure-task-state">
                        {activeMatoaComplete
                          ? 'DONE'
                          : 'IN PROGRESS'}
                      </span>
                    </div>

                    <div className="closure-subtasks">
                      <button
                        className="closure-subtask"
                        data-checked={
                          activeClosureChecklist.matoaClearance.statusTt
                            ? 'true'
                            : 'false'
                        }
                        type="button"
                        onClick={() =>
                          toggleClosureTask(
                            'matoaStatusTt'
                          )
                        }
                      >
                        <span className="closure-checkbox">
                          {activeClosureChecklist.matoaClearance.statusTt ? (
                            <Check
                              size={12}
                            />
                          ) : null}
                        </span>

                        <span>
                          Status TT
                        </span>
                      </button>

                      <button
                        className="closure-subtask"
                        data-checked={
                          activeClosureChecklist.matoaClearance.eventAndPhoto
                            ? 'true'
                            : 'false'
                        }
                        type="button"
                        onClick={() =>
                          toggleClosureTask(
                            'matoaEventAndPhoto'
                          )
                        }
                      >
                        <span className="closure-checkbox">
                          {activeClosureChecklist.matoaClearance.eventAndPhoto ? (
                            <Check
                              size={12}
                            />
                          ) : null}
                        </span>

                        <span>
                          Event and Photo
                        </span>
                      </button>

                      <button
                        className="closure-subtask"
                        data-checked={
                          activeClosureChecklist.matoaClearance.rfo
                            ? 'true'
                            : 'false'
                        }
                        type="button"
                        onClick={() =>
                          toggleClosureTask(
                            'matoaRfo'
                          )
                        }
                      >
                        <span className="closure-checkbox">
                          {activeClosureChecklist.matoaClearance.rfo ? (
                            <Check
                              size={12}
                            />
                          ) : null}
                        </span>

                        <span>
                          RFO
                        </span>
                      </button>
                    </div>
                  </div>

                  <button
                    className="closure-task"
                    data-checked={
                      activeClosureChecklist.sentClosedEmail
                        ? 'true'
                        : 'false'
                    }
                    type="button"
                    onClick={() =>
                      toggleClosureTask(
                        'sentClosedEmail'
                      )
                    }
                  >
                    <span className="closure-checkbox">
                      {activeClosureChecklist.sentClosedEmail ? (
                        <Check
                          size={13}
                        />
                      ) : null}
                    </span>

                    <span className="closure-task-copy">
                      <strong>
                        Sent Closed Email
                      </strong>

                      <small>
                        Confirm final closed
                        notification email has
                        been sent.
                      </small>
                    </span>

                    <span className="closure-task-state">
                      {activeClosureChecklist.sentClosedEmail
                        ? 'DONE'
                        : 'PENDING'}
                    </span>
                  </button>
                </div>

                <div className="closure-footer">
                  <span>
                    {activeClosureComplete
                      ? 'Ready for administrative close.'
                      : (
                          CLOSURE_ATOMIC_TASK_COUNT -
                          activeClosureCompleted
                        ) +
                        ' closure task' +
                        (
                          CLOSURE_ATOMIC_TASK_COUNT -
                          activeClosureCompleted ===
                          1
                            ? ''
                            : 's'
                        ) +
                        ' remaining.'}
                  </span>

                  <strong>
                    {
                      activeClosureScore
                    }% READY
                  </strong>
                </div>
              </section>
            </section>

            <aside
              className="preview-column"
              data-mobile-hidden={
                mobilePane !== 'preview'
              }
            >
              <div className="preview-card glass-panel">
                <div className="preview-header">
                  <div>
                    <div className="eyebrow">
                      <Gauge size={13} />
                      Output monitor
                    </div>

                    <h2>
                      Report preview
                    </h2>
                  </div>

                  <span className="live-badge">
                    <span />
                    LIVE
                  </span>
                </div>

                <div className="report-paper">
                  <div className="paper-toolbar">
                    <div className="paper-dots">
                      <span />
                      <span />
                      <span />
                    </div>

                    <span>
                      formatted-output.txt
                    </span>

                    <ShieldCheck
                      size={14}
                    />
                  </div>

                  <pre>{generated}</pre>
                </div>

                <div className="preview-metrics">
                  <div>
                    <span>
                      Completion
                    </span>

                    <strong>
                      {score}%
                    </strong>
                  </div>

                  <div>
                    <span>
                      Updates
                    </span>

                    <strong>
                      {
                        report.progress
                          .length
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Storage
                    </span>

                    <strong>
                      Local
                    </strong>
                  </div>
                </div>

                <button
                  className="primary-action"
                  type="button"
                  onClick={copyReport}
                >
                  {copied ? (
                    <Check size={18} />
                  ) : (
                    <Copy size={18} />
                  )}

                  <span>
                    {copied
                      ? 'Copied to clipboard'
                      : 'Copy formatted report'}
                  </span>

                  <kbd>CTRL C</kbd>
                </button>

                <div className="preview-secondary-actions">
                  <button
                    type="button"
                    onClick={
                      resetToSample
                    }
                  >
                    <RotateCcw
                      size={15}
                    />
                    Restore sample
                  </button>

                  <button
                    type="button"
                    onClick={
                      clearReport
                    }
                  >
                    <Trash2 size={15} />
                    Clear draft
                  </button>
                </div>
              </div>

              <section className="delivery-console-card glass-panel">
                <div className="delivery-console-head">
                  <div>
                    <span className="delivery-kicker">
                      SMART CLOSE / DELIVERY
                    </span>

                    <h3>
                      Delivery console
                    </h3>

                    <p>
                      Prepare operational handoff,
                      closure email, and final
                      archive without rebuilding
                      the report manually.
                    </p>
                  </div>

                  <span
                    className="delivery-ready-chip"
                    data-ready={
                      deliveryValidation.canFinalize
                        ? 'true'
                        : 'false'
                    }
                  >
                    {deliveryValidation.canFinalize
                      ? 'READY TO CLOSE'
                      : 'VALIDATION ACTIVE'}
                  </span>
                </div>

                <div className="delivery-validation-grid">
                  <div>
                    <span>
                      STATUS
                    </span>

                    <strong>
                      {
                        operationalStatusLabel(
                          deliveryValidation.operationalStatus
                        )
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      REPORT
                    </span>

                    <strong>
                      {
                        deliveryValidation.reportScore
                      }%
                    </strong>
                  </div>

                  <div>
                    <span>
                      CLOSURE
                    </span>

                    <strong>
                      {
                        deliveryValidation.closureScore
                      }%
                    </strong>
                  </div>
                </div>

                {deliveryValidation.blockers.length >
                0 ? (
                  <div className="delivery-blockers">
                    <div className="delivery-blocker-title">
                      <AlertTriangle
                        size={13}
                      />
                      Close validation
                    </div>

                    {deliveryValidation.blockers.map(
                      (blocker) => (
                        <span
                          key={
                            blocker
                          }
                        >
                          {blocker}
                        </span>
                      )
                    )}
                  </div>
                ) : (
                  <div className="delivery-clear">
                    <ShieldCheck
                      size={14}
                    />

                    <div>
                      <strong>
                        Closure gate passed
                      </strong>

                      <span>
                        Operational restoration,
                        report completeness, and
                        administration are ready.
                      </span>
                    </div>
                  </div>
                )}

                <div className="delivery-action-grid">
                  <button
                    className="delivery-action-card"
                    type="button"
                    disabled={
                      !deliveryValidation.canCopyWag
                    }
                    onClick={() =>
                      copyDelivery(
                        'wag',
                        formatWagDelivery(
                          report
                        )
                      )
                    }
                  >
                    <span className="delivery-action-icon">
                      {deliveryCopied ===
                      'wag' ? (
                        <Check
                          size={16}
                        />
                      ) : (
                        <Copy
                          size={16}
                        />
                      )}
                    </span>

                    <span>
                      <strong>
                        {deliveryCopied ===
                        'wag'
                          ? 'WAG copied'
                          : 'Copy WAG report'}
                      </strong>

                      <small>
                        Exact ReportOS output,
                        including impacts and CP.
                      </small>
                    </span>
                  </button>

                  <button
                    className="delivery-action-card"
                    type="button"
                    disabled={
                      !deliveryValidation.canPrepareClosedEmail
                    }
                    title={
                      deliveryValidation.canPrepareClosedEmail
                        ? 'Copy closed email draft'
                        : 'Requires RESTORED status and a complete report'
                    }
                    onClick={() =>
                      copyDelivery(
                        'email',
                        'Subject: ' +
                          closedEmailDraft.subject +
                          '\n\n' +
                          closedEmailDraft.body
                      )
                    }
                  >
                    <span className="delivery-action-icon">
                      {deliveryCopied ===
                      'email' ? (
                        <Check
                          size={16}
                        />
                      ) : (
                        <Mail
                          size={16}
                        />
                      )}
                    </span>

                    <span>
                      <strong>
                        {deliveryCopied ===
                        'email'
                          ? 'Email copied'
                          : 'Closed email'}
                      </strong>

                      <small>
                        Generic closure draft;
                        recipients stay manual.
                      </small>
                    </span>
                  </button>

                  <button
                    className="delivery-action-card"
                    type="button"
                    disabled={
                      !deliveryValidation.canFinalize
                    }
                    title={
                      deliveryValidation.canFinalize
                        ? 'Copy final closure package'
                        : 'Resolve all close blockers first'
                    }
                    onClick={() =>
                      copyDelivery(
                        'package',
                        finalClosurePackage
                      )
                    }
                  >
                    <span className="delivery-action-icon">
                      {deliveryCopied ===
                      'package' ? (
                        <Check
                          size={16}
                        />
                      ) : (
                        <FileText
                          size={16}
                        />
                      )}
                    </span>

                    <span>
                      <strong>
                        {deliveryCopied ===
                        'package'
                          ? 'Package copied'
                          : 'Final package'}
                      </strong>

                      <small>
                        Full report plus closure
                        administration audit.
                      </small>
                    </span>
                  </button>
                </div>

                <button
                  className="delivery-finalize-button"
                  type="button"
                  disabled={
                    !deliveryValidation.canFinalize ||
                    activeIncident?.status ===
                      'archived'
                  }
                  onClick={
                    finalizeIncident
                  }
                >
                  {activeIncident?.status ===
                  'archived' ? (
                    <>
                      <Check
                        size={16}
                      />
                      Incident already archived
                    </>
                  ) : (
                    <>
                      <Archive
                        size={16}
                      />
                      Finalize & archive incident
                    </>
                  )}
                </button>

                <p className="delivery-footnote">
                  Copy actions never mark WAG or
                  email tasks as sent automatically.
                  Checklist confirmation remains an
                  explicit operator action.
                </p>
              </section>

              <div className="shortcut-card glass-panel">
                <div className="shortcut-icon">
                  <Clipboard size={17} />
                </div>

                <div>
                  <strong>
                    Fast operator flow
                  </strong>

                  <p>
                    Use <kbd>Ctrl</kbd> +{' '}
                    <kbd>Enter</kbd> while
                    writing a progress line
                    to append it instantly.
                  </p>
                </div>
              </div>
            </aside>
          </div>
            </>
          )}
        </section>

        <nav
          className="bottom-nav glass-panel"
          aria-label="Mobile navigation"
        >
          <button
            className={
              workspaceMode ===
                'compose'
                ? 'bottom-nav-active'
                : ''
            }
            type="button"
            onClick={() =>
              setWorkspaceMode(
                'compose'
              )
            }
          >
            <WandSparkles size={18} />
            <span>Composer</span>
          </button>

          <button
            className={
              workspaceMode ===
                'operations'
                ? 'bottom-nav-active'
                : ''
            }
            type="button"
            onClick={() =>
              setWorkspaceMode(
                'operations'
              )
            }
          >
            <Gauge size={18} />
            <span>Operations</span>
          </button>

          <button
            className={
              workspaceMode ===
                'archive'
                ? 'bottom-nav-active'
                : ''
            }
            type="button"
            onClick={() =>
              setWorkspaceMode(
                'archive'
              )
            }
          >
            <Archive size={18} />
            <span>Archive</span>
          </button>

          <Link
            className="bottom-nav-tool"
            href="/sor-to-pdf"
          >
            <FileOutput
              size={18}
            />
            <span>
              SOR PDF
            </span>
          </Link>
        </nav>
      </main>
    </MotionConfig>
  );
}
