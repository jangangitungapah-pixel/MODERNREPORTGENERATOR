'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  analyzeIncident,
  whatIsPending,
} from '@/lib/incident-intelligence';

import {
  buildRfoDraft,
} from '@/lib/rfo-builder';

import {
  buildShiftHandover,
} from '@/lib/handover';

import {
  deserializeWorkspace,
  type WorkspaceSnapshot,
} from '@/lib/workspace';

import styles from './reportos-intelligence.module.css';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const WORKSPACE_STORAGE_KEY =
  'reportos:workspace:v1';

function readWorkspace(): WorkspaceSnapshot | null {
  return deserializeWorkspace(
    window.localStorage.getItem(
      WORKSPACE_STORAGE_KEY
    )
  );
}

async function copyText(
  value: string
): Promise<void> {
  await navigator.clipboard.writeText(
    value
  );
}

export function ReportOsIntelligence() {
  const [
    workspace,
    setWorkspace,
  ] = useState<WorkspaceSnapshot | null>(
    null
  );

  const [open, setOpen] =
    useState(false);

  const triggerRef =
    useRef<HTMLButtonElement>(null);

  const panelRef =
    useRef<HTMLElement>(null);

  const closeRef =
    useRef<HTMLButtonElement>(null);

  const [copied, setCopied] =
    useState<
      | 'rfo'
      | 'handover'
      | null
    >(null);

  useEffect(() => {
    const refresh = () => {
      setWorkspace(
        readWorkspace()
      );
    };

    refresh();

    const timer =
      window.setInterval(
        refresh,
        1_000
      );

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    const returnFocusTarget =
      triggerRef.current;

    document.body.style.overflow =
      'hidden';

    const focusFrame =
      window.requestAnimationFrame(
        () => {
          closeRef.current?.focus();
        }
      );

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (
        event.key !== 'Tab' ||
        !panelRef.current
      ) {
        return;
      }

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          FOCUSABLE_SELECTOR
        )
      );

      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last =
        focusable[focusable.length - 1];

      if (
        event.shiftKey &&
        document.activeElement === first
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener(
      'keydown',
      handleKeyDown
    );

    return () => {
      window.cancelAnimationFrame(
        focusFrame
      );
      document.removeEventListener(
        'keydown',
        handleKeyDown
      );
      document.body.style.overflow =
        previousOverflow;
      if (returnFocusTarget?.isConnected) {
        returnFocusTarget.focus();
      }
    };
  }, [open]);

  const activeIncident =
    useMemo(
      () => {
        if (!workspace) {
          return null;
        }

        return (
          workspace.incidents.find(
            (incident) =>
              incident.id ===
              workspace.activeIncidentId
          ) ??
          workspace.incidents[0] ??
          null
        );
      },
      [workspace]
    );

  const findings =
    useMemo(
      () =>
        activeIncident
          ? analyzeIncident({
              report:
                activeIncident.report,
              closureChecklist:
                activeIncident.closureChecklist,
            })
          : [],
      [activeIncident]
    );

  const pending =
    useMemo(
      () =>
        activeIncident
          ? whatIsPending({
              report:
                activeIncident.report,
              closureChecklist:
                activeIncident.closureChecklist,
            })
          : [],
      [activeIncident]
    );

  const criticalCount =
    findings.filter(
      (finding) =>
        finding.severity ===
        'critical'
    ).length;

  if (!activeIncident) {
    return null;
  }

  const handleCopy = async (
    type:
      | 'rfo'
      | 'handover'
  ) => {
    const value =
      type === 'rfo'
        ? buildRfoDraft(
            activeIncident.report
          )
        : buildShiftHandover(
            workspace?.incidents ??
              []
          );

    await copyText(value);
    setCopied(type);

    window.setTimeout(
      () => {
        setCopied(null);
      },
      1_500
    );
  };

  return (
    <>
      <button
        ref={triggerRef}
        className={styles.trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="reportos-intelligence-dialog"
        onClick={() =>
          setOpen(true)
        }
      >
        Intelligence
        <span
          className={styles.badge}
        >
          {findings.length +
            pending.length}
        </span>
      </button>

      {open ? (
        <div
          className={styles.overlay}
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setOpen(false);
            }
          }}
        >
          <section
            ref={panelRef}
            id="reportos-intelligence-dialog"
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reportos-intelligence-title"
            tabIndex={-1}
          >
            <header
              className={styles.header}
            >
              <div>
                <span
                  className={styles.eyebrow}
                >
                  REPORTOS INTELLIGENCE
                </span>
                <h2
                  id="reportos-intelligence-title"
                >
                  Operational readiness
                </h2>
                <p>
                  Deterministic checks for the active TT. No paid AI service is used.
                </p>
              </div>

              <button
                ref={closeRef}
                className={styles.close}
                type="button"
                aria-label="Close intelligence"
                onClick={() =>
                  setOpen(false)
                }
              >
                ×
              </button>
            </header>

            <div
              className={styles.summary}
            >
              <div
                className={styles.metric}
              >
                <span>FINDINGS</span>
                <strong>
                  {findings.length}
                </strong>
              </div>
              <div
                className={styles.metric}
              >
                <span>CRITICAL</span>
                <strong>
                  {criticalCount}
                </strong>
              </div>
              <div
                className={styles.metric}
              >
                <span>PENDING</span>
                <strong>
                  {pending.length}
                </strong>
              </div>
            </div>

            <section
              className={styles.section}
            >
              <h3
                className={styles.sectionTitle}
              >
                CONTRADICTION CHECK
              </h3>

              <div
                className={styles.findings}
              >
                {findings.length > 0 ? (
                  findings.map(
                    (finding) => (
                      <article
                        className={`${styles.finding} ${styles[finding.severity]}`}
                        key={finding.id}
                      >
                        <strong>
                          {finding.title}
                        </strong>
                        <p>
                          {finding.detail}
                        </p>
                      </article>
                    )
                  )
                ) : (
                  <div
                    className={styles.clear}
                  >
                    No contradiction detected in the active TT.
                  </div>
                )}
              </div>
            </section>

            <section
              className={styles.section}
            >
              <h3
                className={styles.sectionTitle}
              >
                WHAT&apos;S PENDING
              </h3>

              <div
                className={styles.pending}
              >
                {pending.length > 0 ? (
                  pending.map(
                    (item) => (
                      <div
                        className={styles.pendingItem}
                        key={item}
                      >
                        {item}
                      </div>
                    )
                  )
                ) : (
                  <div
                    className={styles.clear}
                  >
                    This TT has no pending operational task.
                  </div>
                )}
              </div>
            </section>

            <div
              className={styles.actions}
            >
              <button
                type="button"
                onClick={() => {
                  void handleCopy(
                    'rfo'
                  );
                }}
              >
                {copied === 'rfo'
                  ? 'RFO copied'
                  : 'Copy RFO draft'}
              </button>

              <button
                type="button"
                onClick={() => {
                  void handleCopy(
                    'handover'
                  );
                }}
              >
                {copied ===
                'handover'
                  ? 'Handover copied'
                  : 'Copy shift handover'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
