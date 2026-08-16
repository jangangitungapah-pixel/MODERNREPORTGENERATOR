'use client';

import {
  Activity,
  Archive,
  Check,
  ChevronRight,
  Clipboard,
  Clock3,
  Command,
  Copy,
  FileText,
  Gauge,
  Layers3,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  WandSparkles,
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
  formatReport,
  type IncidentReport,
} from '@/lib/report';

const STORAGE_KEY = 'reportos:draft:v1';

type MobilePane = 'compose' | 'preview';

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

  const [entryTime, setEntryTime] =
    useState('');

  const [entryText, setEntryText] =
    useState('');

  const [copied, setCopied] =
    useState(false);

  useEffect(() => {
    try {
      const saved =
        window.localStorage.getItem(
          STORAGE_KEY
        );

      if (saved) {
        setReport(
          JSON.parse(saved) as IncidentReport
        );
      }
    } catch {
      // Broken local drafts must never block the app.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(report)
    );
  }, [hydrated, report]);

  const generated = useMemo(
    () => formatReport(report),
    [report]
  );

  const score = useMemo(
    () => completionScore(report),
    [report]
  );

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
    const time = entryTime.trim();
    const text = entryText.trim();

    if (!time || !text) return;

    setReport((current) => ({
      ...current,
      progress: [
        ...current.progress,
        {
          id:
            typeof crypto !== 'undefined' &&
            'randomUUID' in crypto
              ? crypto.randomUUID()
              : String(Date.now()),
          time,
          text,
        },
      ],
    }));

    setEntryTime('');
    setEntryText('');
  }

  function removeProgress(id: string) {
    setReport((current) => ({
      ...current,
      progress: current.progress.filter(
        (entry) => entry.id !== id
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
  }

  function clearReport() {
    setReport(EMPTY_REPORT);
    setEntryTime('');
    setEntryText('');
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
              className="nav-item nav-item-active"
              type="button"
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
              className="nav-item"
              type="button"
            >
              <Archive size={18} />

              <span className="nav-copy">
                <strong>Archive</strong>
                <small>
                  Saved incidents
                </small>
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
                Compose with clarity.
              </h1>
            </div>

            <div className="topbar-actions">
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

                <div className="timeline-list">
                  <AnimatePresence
                    initial={false}
                  >
                    {report.progress.map(
                      (entry, index) => (
                        <motion.div
                          className="timeline-row"
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

                          <div className="timeline-time">
                            {entry.time}
                          </div>

                          <p>
                            {entry.text}
                          </p>

                          <button
                            className="row-delete"
                            type="button"
                            title="Delete update"
                            onClick={() =>
                              removeProgress(
                                entry.id
                              )
                            }
                          >
                            <Trash2
                              size={15}
                            />
                          </button>
                        </motion.div>
                      )
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
        </section>

        <nav
          className="bottom-nav glass-panel"
          aria-label="Mobile navigation"
        >
          <button
            className="bottom-nav-active"
            type="button"
          >
            <WandSparkles size={18} />
            <span>Composer</span>
          </button>

          <button type="button">
            <Activity size={18} />
            <span>Timeline</span>
          </button>

          <button type="button">
            <Archive size={18} />
            <span>Archive</span>
          </button>
        </nav>
      </main>
    </MotionConfig>
  );
}
