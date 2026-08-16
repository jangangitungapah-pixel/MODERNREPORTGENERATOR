'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Database,
  History,
  RefreshCw,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';

import {
  AdminClientError,
  loadAuditEvents,
  loadCanonicalStatus,
  loadRecoverySnapshots,
  loadSystemSession,
  restoreRecoverySnapshot,
  type AuditEvent,
  type CanonicalStatus,
  type RecoverySnapshot,
  type SystemSession,
} from '@/lib/reportos-admin-client';

import styles from './system.module.css';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

type ConsoleProblem = {
  code: string;
  message: string;
};

function timeLabel(value: number | null): string {
  if (!value) {
    return 'Never';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function bytesLabel(value: number): string {
  if (value < 1_024) {
    return `${value} B`;
  }

  if (value < 1_048_576) {
    return `${(value / 1_024).toFixed(1)} KB`;
  }

  return `${(value / 1_048_576).toFixed(1)} MB`;
}

function LoadingValue() {
  return (
    <span
      className={styles.skeletonValue}
      aria-hidden="true"
    />
  );
}

export function SystemConsole() {
  const router = useRouter();

  const [session, setSession] =
    useState<SystemSession | null>(null);
  const [canonical, setCanonical] =
    useState<CanonicalStatus | null>(null);
  const [snapshots, setSnapshots] =
    useState<RecoverySnapshot[]>([]);
  const [audit, setAudit] =
    useState<AuditEvent[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [slowLoading, setSlowLoading] =
    useState(false);
  const [problem, setProblem] =
    useState<ConsoleProblem | null>(null);
  const [restoreProblem, setRestoreProblem] =
    useState<string | null>(null);
  const [restoringId, setRestoringId] =
    useState<string | null>(null);
  const [confirmId, setConfirmId] =
    useState<string | null>(null);

  const modalRef = useRef<HTMLElement>(null);
  const cancelRef =
    useRef<HTMLButtonElement>(null);
  const restoreReturnFocusRef =
    useRef<HTMLElement | null>(null);
  const restoringIdRef =
    useRef<string | null>(null);

  const selectedSnapshot = useMemo(
    () =>
      snapshots.find(
        (snapshot) => snapshot.id === confirmId
      ) ?? null,
    [confirmId, snapshots]
  );

  const canRestore =
    session?.workspace.role === 'supervisor' ||
    session?.workspace.role === 'admin';

  const refresh = useCallback(async () => {
    setLoading(true);
    setSlowLoading(false);
    setProblem(null);

    try {
      const [
        nextSession,
        nextCanonical,
        nextSnapshots,
        nextAudit,
      ] = await Promise.all([
        loadSystemSession(),
        loadCanonicalStatus(),
        loadRecoverySnapshots(),
        loadAuditEvents(),
      ]);

      setSession(nextSession);
      setCanonical(nextCanonical);
      setSnapshots(nextSnapshots);
      setAudit(nextAudit);
    } catch (loadError) {
      if (loadError instanceof AdminClientError) {
        setProblem({
          code: loadError.code,
          message: loadError.message,
        });
      } else {
        setProblem({
          code: 'SYSTEM_CONSOLE_UNAVAILABLE',
          message:
            'System Console could not load its server state.',
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) {
        void refresh();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (!loading) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSlowLoading(true);
    }, 8_000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loading]);

  useEffect(() => {
    if (!confirmId) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusFrame =
      window.requestAnimationFrame(() => {
        cancelRef.current?.focus();
      });

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (
        event.key === 'Escape' &&
        !restoringIdRef.current
      ) {
        event.preventDefault();
        setConfirmId(null);
        return;
      }

      if (
        event.key !== 'Tab' ||
        !modalRef.current
      ) {
        return;
      }

      const focusable = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          FOCUSABLE_SELECTOR
        )
      ).filter(
        (element) =>
          !element.hasAttribute('disabled')
      );

      if (focusable.length === 0) {
        event.preventDefault();
        modalRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

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
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener(
        'keydown',
        handleKeyDown
      );
      document.body.style.overflow =
        previousOverflow;

      const returnTarget =
        restoreReturnFocusRef.current;
      if (returnTarget?.isConnected) {
        returnTarget.focus();
      }
      restoreReturnFocusRef.current = null;
    };
  }, [confirmId]);

  const requestRestore = (
    snapshotId: string,
    trigger: HTMLButtonElement
  ) => {
    if (!canRestore) {
      return;
    }

    restoreReturnFocusRef.current = trigger;
    setRestoreProblem(null);
    setConfirmId(snapshotId);
  };

  const closeConfirmation = () => {
    if (!restoringIdRef.current) {
      setConfirmId(null);
    }
  };

  const restore = async (snapshotId: string) => {
    if (!canRestore) {
      setRestoreProblem(
        'Supervisor or admin access is required to restore a snapshot.'
      );
      return;
    }

    restoringIdRef.current = snapshotId;
    setRestoringId(snapshotId);
    setRestoreProblem(null);

    try {
      await restoreRecoverySnapshot(snapshotId);
      setConfirmId(null);
      router.push('/');
      router.refresh();
    } catch (restoreError) {
      setRestoreProblem(
        restoreError instanceof Error
          ? restoreError.message
          : 'Recovery restore failed.'
      );
    } finally {
      restoringIdRef.current = null;
      setRestoringId(null);
    }
  };

  const statusTone = problem
    ? 'error'
    : session
      ? 'ready'
      : 'connecting';
  const statusLabel = problem
    ? 'Control plane needs attention'
    : session
      ? 'Authenticated control plane'
      : 'Authenticating control plane';
  const showSkeletons = loading && !session;
  return (
    <main
      className={styles.page}
      aria-busy={loading}
    >
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <div className={styles.headingBlock}>
            <Link className={styles.back} href="/">
              <ArrowLeft size={15} />
              Back to ReportOS
            </Link>

            <span className={styles.eyebrow}>
              REPORTOS CONTROL PLANE
            </span>
            <h1 className={styles.title}>
              System Console
            </h1>
            <p className={styles.subtitle}>
              Inspect authenticated identity, canonical
              database state, recovery history, and
              immutable operational audit activity.
            </p>
          </div>

          <div className={styles.topbarActions}>
            <button
              className={styles.refresh}
              type="button"
              disabled={loading}
              onClick={() => {
                void refresh();
              }}
            >
              <RefreshCw
                size={15}
                className={
                  loading
                    ? styles.spinning
                    : undefined
                }
              />
              {loading ? 'Refreshing' : 'Refresh'}
            </button>

            <div
              className={styles.status}
              data-tone={statusTone}
              role="status"
              aria-live="polite"
            >
              <span
                className={styles.statusDot}
                aria-hidden="true"
              />
              {statusLabel}
            </div>
          </div>
        </header>

        {slowLoading && !problem ? (
          <div className={styles.notice} role="status">
            <RefreshCw size={18} />
            <div>
              <strong>
                Still resolving authenticated system data
              </strong>
              <span>
                Your local workspace remains available.
                This console is waiting for Firebase and
                canonical server state.
              </span>
            </div>
          </div>
        ) : null}

        {problem ? (
          <div className={styles.error} role="alert">
            <AlertTriangle size={20} />
            <div>
              <strong>
                System data could not be refreshed
              </strong>
              <span>
                {problem.message} Your local workspace was
                not cleared or replaced by this screen.
              </span>
              <code>{problem.code}</code>
            </div>
            <button
              type="button"
              onClick={() => {
                void refresh();
              }}
            >
              Try again
            </button>
          </div>
        ) : null}

        <section
          className={styles.grid}
          aria-label="System summary"
        >
          <article className={styles.card}>
            <span className={styles.cardIcon}>
              <UserRound size={18} />
            </span>
            <span className={styles.cardLabel}>
              IDENTITY
            </span>
            <strong className={styles.cardValue}>
              {showSkeletons ? (
                <LoadingValue />
              ) : session?.user.anonymous ? (
                'Anonymous'
              ) : (
                session?.user.displayName ??
                session?.user.provider ??
                'Unavailable'
              )}
            </strong>
            <span className={styles.cardDetail}>
              {showSkeletons ? (
                <span
                  className={styles.skeletonLine}
                  aria-hidden="true"
                />
              ) : (
                session?.user.email ??
                session?.user.uid ??
                'Identity data unavailable'
              )}
            </span>
          </article>

          <article className={styles.card}>
            <span className={styles.cardIcon}>
              <ShieldCheck size={18} />
            </span>
            <span className={styles.cardLabel}>
              WORKSPACE ROLE
            </span>
            <strong className={styles.cardValue}>
              {showSkeletons ? (
                <LoadingValue />
              ) : (
                session?.workspace.role ??
                'Unavailable'
              )}
            </strong>
            <span className={styles.cardDetail}>
              {showSkeletons ? (
                <span
                  className={styles.skeletonLine}
                  aria-hidden="true"
                />
              ) : (
                session?.workspace.name ??
                'ReportOS Workspace'
              )}
            </span>
          </article>

          <article className={styles.card}>
            <span className={styles.cardIcon}>
              <Database size={18} />
            </span>
            <span className={styles.cardLabel}>
              CANONICAL REVISION
            </span>
            <strong
              className={`${styles.cardValue} ${styles.numericValue}`}
            >
              {showSkeletons ? (
                <LoadingValue />
              ) : (
                canonical?.revision ?? 0
              )}
            </strong>
            <span className={styles.cardDetail}>
              {showSkeletons ? (
                <span
                  className={styles.skeletonLine}
                  aria-hidden="true"
                />
              ) : (
                `${canonical?.incidentCount ?? 0} incidents · ${timeLabel(
                  canonical?.updatedAt ?? null
                )}`
              )}
            </span>
          </article>

          <article className={styles.card}>
            <span className={styles.cardIcon}>
              <History size={18} />
            </span>
            <span className={styles.cardLabel}>
              RECOVERY POINTS
            </span>
            <strong
              className={`${styles.cardValue} ${styles.numericValue}`}
            >
              {showSkeletons ? (
                <LoadingValue />
              ) : snapshots.length}
            </strong>
            <span className={styles.cardDetail}>
              {showSkeletons ? (
                <span
                  className={styles.skeletonLine}
                  aria-hidden="true"
                />
              ) : (
                'D1 safety history'
              )}
            </span>
          </article>
        </section>

        <div className={styles.columns}>
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionIcon}>
                  <History size={17} />
                </span>
                <div>
                  <h2>Recovery history</h2>
                  <p>
                    Snapshots created before destructive
                    or revision-changing operations.
                  </p>
                </div>
              </div>
              <span className={styles.count}>
                {snapshots.length}
              </span>
            </div>

            {session && !canRestore ? (
              <div className={styles.permissionNote}>
                <ShieldCheck size={16} />
                <span>
                  Recovery restore requires supervisor or
                  admin workspace access. Your current
                  role is read-only for this action.
                </span>
              </div>
            ) : null}

            <div className={styles.list}>
              {showSkeletons ? (
                [0, 1, 2].map((item) => (
                  <div
                    className={styles.skeletonRow}
                    key={item}
                    aria-hidden="true"
                  />
                ))
              ) : snapshots.length > 0 ? (
                snapshots.map((snapshot) => (
                  <article
                    className={styles.row}
                    key={snapshot.id}
                  >
                    <div className={styles.rowMain}>
                      <strong>{snapshot.reason}</strong>
                      <span>
                        {timeLabel(snapshot.createdAt)} ·{' '}
                        {bytesLabel(snapshot.payloadBytes)}
                      </span>
                      <code>{snapshot.id}</code>
                    </div>
                    <button
                      type="button"
                      disabled={
                        Boolean(restoringId) ||
                        !canRestore
                      }
                      title={
                        canRestore
                          ? 'Restore this D1 snapshot'
                          : 'Supervisor or admin access required'
                      }
                      onClick={(event) =>
                        canRestore
                          ? requestRestore(
                              snapshot.id,
                              event.currentTarget
                            )
                          : undefined
                      }
                    >
                      Restore
                    </button>
                  </article>
                ))
              ) : (
                <div className={styles.empty}>
                  <ShieldCheck size={22} />
                  <strong>
                    No recovery snapshot yet
                  </strong>
                  <span>
                    D1 safety history appears after the
                    first protected canonical change.
                  </span>
                </div>
              )}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionIcon}>
                  <Activity size={17} />
                </span>
                <div>
                  <h2>Audit trail</h2>
                  <p>
                    Latest server-side workspace mutations
                    with actor and request correlation.
                  </p>
                </div>
              </div>
              <span className={styles.count}>
                {audit.length}
              </span>
            </div>

            <div className={styles.list}>
              {showSkeletons ? (
                [0, 1, 2].map((item) => (
                  <div
                    className={styles.skeletonRow}
                    key={item}
                    aria-hidden="true"
                  />
                ))
              ) : audit.length > 0 ? (
                audit.map((event) => (
                  <article
                    className={styles.row}
                    key={event.id}
                  >
                    <div className={styles.rowMain}>
                      <strong>{event.action}</strong>
                      <span>
                        {timeLabel(event.createdAt)}
                      </span>
                      <code>{event.actorUid}</code>
                    </div>
                    <Database
                      className={styles.rowGlyph}
                      size={16}
                      aria-hidden="true"
                    />
                  </article>
                ))
              ) : (
                <div className={styles.empty}>
                  <Activity size={22} />
                  <strong>No audit event yet</strong>
                  <span>
                    Server-side workspace mutations will
                    appear here with actor context.
                  </span>
                </div>
              )}
            </div>
          </section>
        </div>

        <section
          className={`${styles.section} ${styles.governance}`}
        >
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.sectionIcon}>
                <ShieldCheck size={17} />
              </span>
              <div>
                <h2>Governance status</h2>
                <p>
                  Firebase-authenticated server identity;
                  D1 access remains server-only.
                </p>
              </div>
            </div>
          </div>

          <div className={styles.governanceGrid}>
            <div className={styles.governanceItem}>
              <span>CANONICAL CHECKSUM</span>
              <code>
                {showSkeletons
                  ? 'Resolving canonical checksum…'
                  : canonical?.checksum ??
                    'No canonical state yet'}
              </code>
            </div>
            <div className={styles.governanceItem}>
              <span>LAST WRITER</span>
              <code>
                {showSkeletons
                  ? 'Resolving canonical writer…'
                  : canonical?.updatedBy ??
                    'No canonical writer yet'}
              </code>
            </div>
          </div>
        </section>
      </div>

      {selectedSnapshot ? (
        <div
          className={styles.modalOverlay}
          role="presentation"
        >
          <section
            ref={modalRef}
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="restore-title"
            aria-describedby="restore-description"
            aria-busy={Boolean(restoringId)}
            tabIndex={-1}
          >
            <header className={styles.modalHeader}>
              <span className={styles.modalIcon}>
                <History size={20} />
              </span>
              <div>
                <span>HIGH-RISK RECOVERY</span>
                <h2 id="restore-title">
                  Restore this snapshot?
                </h2>
              </div>
              <button
                type="button"
                aria-label="Cancel snapshot restore"
                disabled={Boolean(restoringId)}
                onClick={closeConfirmation}
              >
                <X size={18} />
              </button>
            </header>

            <p id="restore-description">
              The selected D1 snapshot will replace the
              current canonical workspace. ReportOS first
              creates a safety snapshot of the current
              canonical state.
            </p>

            <dl className={styles.snapshotSummary}>
              <div>
                <dt>Reason</dt>
                <dd>{selectedSnapshot.reason}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>
                  {timeLabel(selectedSnapshot.createdAt)}
                </dd>
              </div>
              <div>
                <dt>Payload</dt>
                <dd>
                  {bytesLabel(
                    selectedSnapshot.payloadBytes
                  )}
                </dd>
              </div>
              <div>
                <dt>Snapshot ID</dt>
                <dd>
                  <code>{selectedSnapshot.id}</code>
                </dd>
              </div>
            </dl>

            {restoreProblem ? (
              <div
                className={styles.modalError}
                role="alert"
              >
                <AlertTriangle size={17} />
                <span>{restoreProblem}</span>
              </div>
            ) : null}

            <div className={styles.modalActions}>
              <button
                ref={cancelRef}
                type="button"
                disabled={Boolean(restoringId)}
                onClick={closeConfirmation}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(restoringId)}
                onClick={() => {
                  void restore(selectedSnapshot.id);
                }}
              >
                {restoringId
                  ? 'Restoring snapshot…'
                  : 'Restore snapshot'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
