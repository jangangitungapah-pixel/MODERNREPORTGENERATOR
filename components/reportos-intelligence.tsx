'use client';

import {
  useEffect,
  useMemo,
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
        className={styles.trigger}
        type="button"
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
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reportos-intelligence-title"
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
