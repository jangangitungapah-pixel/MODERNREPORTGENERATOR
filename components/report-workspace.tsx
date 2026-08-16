'use client';

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
  FilePlus2,
  FileText,
  FolderArchive,
  Gauge,
  Layers3,
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
  detectProgressKind,
  duplicateProgressTimes,
  formatReport,
  parseIncidentReport,
  sortProgressChronologically,
  type IncidentReport,
  type ProgressEntry,
} from '@/lib/report';

import {
  createIncidentRecord,
  deserializeWorkspace,
  filterIncidents,
  serializeWorkspace,
  setIncidentArchived,
  sortIncidentsByUpdatedAt,
  upsertIncidentReport,
  type IncidentRecord,
} from '@/lib/workspace';

const STORAGE_KEY = 'reportos:draft:v1';
const WORKSPACE_STORAGE_KEY =
  'reportos:workspace:v1';

type MobilePane = 'compose' | 'preview';
type WorkspaceMode =
  | 'compose'
  | 'archive';

const PROGRESS_KIND_LABELS = {
  coordination: 'Coordination',
  dispatch: 'Dispatch',
  onsite: 'On site',
  repair: 'Repair',
  restored: 'Restored',
  update: 'Update',
} as const;

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

  const [entryTime, setEntryTime] =
    useState('');

  const [entryText, setEntryText] =
    useState('');

  const [copied, setCopied] =
    useState(false);

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

  const activeIncident =
    incidentRecordsForView.find(
      (incident) =>
        incident.id ===
        activeIncidentId
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

    setEntryTime('');
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

    setEntryTime('');
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

  function updateField<
    Key extends keyof IncidentReport
  >(
    key: Key,
    value: IncidentReport[Key]
  ) {
    setReport((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function addProgress() {
    const time =
      entryTime.trim();

    const text =
      entryText.trim();

    if (!time || !text) return;

    setReport((current) => {
      const nextEntry = {
        id:
          typeof crypto !==
            'undefined' &&
          'randomUUID' in crypto
            ? crypto.randomUUID()
            : String(Date.now()),
        time,
        text,
      };

      return {
        ...current,
        progress:
          sortProgressChronologically([
            ...current.progress,
            nextEntry,
          ]),
      };
    });

    setEntryTime('');
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
    setEditingProgressId(
      entry.id
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

    setEditingProgressTime('');
    setEditingProgressText('');
  }

  function saveEditProgress() {
    if (
      !editingProgressId ||
      !editingProgressTime.trim() ||
      !editingProgressText.trim()
    ) {
      return;
    }

    setReport((current) => ({
      ...current,
      progress:
        sortProgressChronologically(
          current.progress.map(
            (entry) =>
              entry.id ===
              editingProgressId
                ? {
                    ...entry,
                    time:
                      editingProgressTime.trim(),
                    text:
                      editingProgressText.trim(),
                  }
                : entry
          )
        ),
    }));

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
          current.progress
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

  function resetToSample() {
    setReport(SAMPLE_REPORT);
    cancelEditProgress();
  }

  function clearReport() {
    setReport(EMPTY_REPORT);
    setEntryTime('');
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

    setEntryTime('');
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
              className="nav-item"
              type="button"
            >
              <Activity size={18} />

              <span className="nav-copy">
                <strong>Timeline</strong>
                <small>
                  Progress stream
                </small>
              </span>
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

              <section className="section-card glass-panel">
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
                      Timing, ownership, and
                      fault context.
                    </p>
                  </div>
                </div>

                <div className="field-grid">
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
                    onChange={(value) =>
                      updateField(
                        'pic',
                        value
                      )
                    }
                  />

                  <Field
                    label="Cut point"
                    value={report.cutPoint}
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
                    value={report.rootcause}
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

                <div className="quick-add">
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
                    className="add-button"
                    type="button"
                    onClick={addProgress}
                    disabled={
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
                        New and edited entries
                        auto-sort by time.
                        Manual reorder stays
                        available when field
                        reality needs it.
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
                      Sort by time
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
                            entry.time.trim()
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
                              <div className="timeline-edit-time">
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
                              </div>
                            ) : (
                              <div className="timeline-time">
                                {
                                  entry.time
                                }

                                {isDuplicate ? (
                                  <span
                                    className="duplicate-dot"
                                    title="Duplicate timeline time"
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

          <button type="button">
            <Activity size={18} />
            <span>Timeline</span>
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
        </nav>
      </main>
    </MotionConfig>
  );
}
