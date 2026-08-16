'use client';

import {
  Check,
  Cloud,
  CloudOff,
  DatabaseBackup,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';

import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ensureFirebaseUser,
  initializeFirebaseAnalytics,
} from '@/lib/firebase-client';

import {
  deleteCloudSnapshot,
  listCloudSnapshots,
  loadCloudWorkspace,
  restoreCloudSnapshot,
  syncCloudWorkspace,
  type CloudSnapshotSummary,
} from '@/lib/firebase-workspace-sync';

const WORKSPACE_STORAGE_KEY =
  'reportos:workspace:v1';

const IMPACT_STORAGE_KEY =
  'reportos:backbone-impact:v1';

const SYNC_INTERVAL_MS =
  2_500;

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type CloudStatus =
  | 'starting'
  | 'syncing'
  | 'ready'
  | 'error';

function readLocal(
  key: string
): string | null {
  if (
    typeof window ===
    'undefined'
  ) {
    return null;
  }

  return window.localStorage.getItem(
    key
  );
}

function writeLocal(
  key: string,
  value: string
): void {
  window.localStorage.setItem(
    key,
    value
  );
}

function clientNow(): number {
  return Date.now();
}

function formatClock(
  value: number
): string {
  return new Intl.DateTimeFormat(
    'en-GB',
    {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }
  ).format(
    new Date(value)
  );
}

function formatSnapshotDate(
  value: number
): string {
  if (!value) {
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
  ).format(
    new Date(value)
  );
}

function shortUid(
  uid: string
): string {
  if (uid.length <= 10) {
    return uid;
  }

  return (
    uid.slice(0, 6) +
    '…' +
    uid.slice(-4)
  );
}

async function syncCurrentLocalState({
  uid,
  previousWorkspaceRaw,
  previousImpactRaw,
}: {
  uid: string;
  previousWorkspaceRaw: string | null;
  previousImpactRaw: string | null;
}) {
  const workspaceRaw =
    readLocal(
      WORKSPACE_STORAGE_KEY
    );

  const impactRaw =
    readLocal(
      IMPACT_STORAGE_KEY
    );

  if (
    workspaceRaw ===
      previousWorkspaceRaw &&
    impactRaw ===
      previousImpactRaw
  ) {
    return {
      changed: false,
      workspaceRaw,
      impactRaw,
      snapshotCreated:
        false,
    };
  }

  const result =
    await syncCloudWorkspace({
      uid,
      workspaceRaw,
      impactRaw,
      previousWorkspaceRaw,
      previousImpactRaw,
    });

  return {
    changed: true,
    workspaceRaw,
    impactRaw,
    snapshotCreated:
      result.snapshotCreated,
  };
}

export function FirebaseCloudRecovery() {
  const [status, setStatus] =
    useState<CloudStatus>(
      'starting'
    );

  const [uid, setUid] =
    useState('');

  const [drawerOpen, setDrawerOpen] =
    useState(false);

  const [snapshots, setSnapshots] =
    useState<
      CloudSnapshotSummary[]
    >([]);

  const [
    lastSyncLabel,
    setLastSyncLabel,
  ] = useState('');

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  const [
    cloudWorkspaceAvailable,
    setCloudWorkspaceAvailable,
  ] = useState(false);

  const previousWorkspaceRef =
    useRef<string | null>(
      null
    );

  const previousImpactRef =
    useRef<string | null>(
      null
    );

  const syncBusyRef =
    useRef(false);

  const triggerRef =
    useRef<HTMLButtonElement>(null);

  const drawerRef =
    useRef<HTMLElement>(null);

  const closeRef =
    useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    async function refreshSnapshots(
      userId: string
    ) {
      const next =
        await listCloudSnapshots(
          userId
        );

      if (!cancelled) {
        setSnapshots(next);
      }
    }

    async function performSync(
      userId: string
    ) {
      if (
        cancelled ||
        syncBusyRef.current
      ) {
        return;
      }

      syncBusyRef.current = true;

      try {
        const result =
          await syncCurrentLocalState({
            uid: userId,
            previousWorkspaceRaw:
              previousWorkspaceRef.current,
            previousImpactRaw:
              previousImpactRef.current,
          });

        if (cancelled) {
          return;
        }

        if (result.changed) {
          previousWorkspaceRef.current =
            result.workspaceRaw;

          previousImpactRef.current =
            result.impactRaw;

          setCloudWorkspaceAvailable(
            Boolean(
              result.workspaceRaw
            )
          );

          setStatus('ready');
          setLastSyncLabel(
            formatClock(
              clientNow()
            )
          );

          if (
            result.snapshotCreated
          ) {
            await refreshSnapshots(
              userId
            );
          }
        }
      } catch (error) {
        if (!cancelled) {
          setStatus('error');
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Cloud sync failed.'
          );
        }
      } finally {
        syncBusyRef.current = false;
      }
    }

    async function bootstrap() {
      try {
        void initializeFirebaseAnalytics();

        const user =
          await ensureFirebaseUser();

        if (cancelled) {
          return;
        }

        setUid(user.uid);

        const cloud =
          await loadCloudWorkspace(
            user.uid
          );

        if (cancelled) {
          return;
        }

        const localWorkspace =
          readLocal(
            WORKSPACE_STORAGE_KEY
          );

        const localImpact =
          readLocal(
            IMPACT_STORAGE_KEY
          );

        setCloudWorkspaceAvailable(
          Boolean(
            cloud.workspaceRaw
          )
        );

        if (
          !localWorkspace &&
          cloud.workspaceRaw
        ) {
          writeLocal(
            WORKSPACE_STORAGE_KEY,
            cloud.workspaceRaw
          );

          if (
            cloud.impactRaw &&
            !localImpact
          ) {
            writeLocal(
              IMPACT_STORAGE_KEY,
              cloud.impactRaw
            );
          }

          window.location.reload();
          return;
        }

        if (
          cloud.impactRaw &&
          !localImpact
        ) {
          writeLocal(
            IMPACT_STORAGE_KEY,
            cloud.impactRaw
          );
        }

        // Keep the cloud copy as the comparison base.
        // When Firestore is empty, null forces the
        // existing local workspace to seed the cloud
        // immediately on first launch.
        previousWorkspaceRef.current =
          cloud.workspaceRaw;

        previousImpactRef.current =
          cloud.impactRaw;

        setStatus('syncing');

        await performSync(
          user.uid
        );

        if (cancelled) {
          return;
        }

        setStatus('ready');
        setLastSyncLabel(
          formatClock(
            clientNow()
          )
        );

        await refreshSnapshots(
          user.uid
        );

        timer =
          window.setInterval(
            () => {
              void performSync(
                user.uid
              );
            },
            SYNC_INTERVAL_MS
          );
      } catch (error) {
        if (!cancelled) {
          setStatus('error');
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Firebase initialization failed.'
          );
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;

      if (timer !== null) {
        window.clearInterval(timer);
      }
    };
  }, []);

  useEffect(() => {
    if (!drawerOpen) {
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
        setDrawerOpen(false);
        return;
      }

      if (
        event.key !== 'Tab' ||
        !drawerRef.current
      ) {
        return;
      }

      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          FOCUSABLE_SELECTOR
        )
      );

      if (focusable.length === 0) {
        event.preventDefault();
        drawerRef.current.focus();
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
  }, [drawerOpen]);

  async function manualSync() {
    if (!uid) {
      return;
    }

    setStatus('syncing');

    try {
      const result =
        await syncCurrentLocalState({
          uid,
          previousWorkspaceRaw:
            previousWorkspaceRef.current,
          previousImpactRaw:
            previousImpactRef.current,
        });

      previousWorkspaceRef.current =
        result.workspaceRaw;

      previousImpactRef.current =
        result.impactRaw;

      setCloudWorkspaceAvailable(
        Boolean(
          result.workspaceRaw
        )
      );

      if (result.snapshotCreated) {
        setSnapshots(
          await listCloudSnapshots(
            uid
          )
        );
      }

      setLastSyncLabel(
        formatClock(
          clientNow()
        )
      );
      setErrorMessage('');
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Cloud sync failed.'
      );
    }
  }

  async function restoreCurrentCloud() {
    if (!uid) {
      return;
    }

    try {
      const cloud =
        await loadCloudWorkspace(uid);

      if (!cloud.workspaceRaw) {
        return;
      }

      writeLocal(
        WORKSPACE_STORAGE_KEY,
        cloud.workspaceRaw
      );

      if (cloud.impactRaw) {
        writeLocal(
          IMPACT_STORAGE_KEY,
          cloud.impactRaw
        );
      }

      window.location.reload();
    } catch (error) {
      setStatus('error');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Cloud restore failed.'
      );
    }
  }

  async function restoreSnapshot(
    snapshotId: string
  ) {
    if (!uid) {
      return;
    }

    try {
      const restored =
        await restoreCloudSnapshot(
          uid,
          snapshotId,
          readLocal(
            WORKSPACE_STORAGE_KEY
          )
        );

      if (!restored) {
        return;
      }

      writeLocal(
        WORKSPACE_STORAGE_KEY,
        restored
      );

      window.location.reload();
    } catch (error) {
      setStatus('error');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Snapshot restore failed.'
      );
    }
  }

  async function removeSnapshot(
    snapshotId: string
  ) {
    if (!uid) {
      return;
    }

    try {
      await deleteCloudSnapshot(
        uid,
        snapshotId
      );

      setSnapshots(
        await listCloudSnapshots(uid)
      );
    } catch (error) {
      setStatus('error');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to delete snapshot.'
      );
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        className="cloud-recovery-trigger"
        data-status={status}
        type="button"
        title="Cloud backup & recovery"
        aria-haspopup="dialog"
        aria-expanded={drawerOpen}
        aria-controls="cloud-recovery-dialog"
        onClick={() =>
          setDrawerOpen(true)
        }
      >
        <span className="cloud-recovery-trigger-icon">
          {status === 'error' ? (
            <CloudOff size={15} />
          ) : status === 'syncing' ||
            status === 'starting' ? (
            <RefreshCw
              className="cloud-recovery-spin"
              size={15}
            />
          ) : (
            <Cloud size={15} />
          )}
        </span>

        <span>
          <strong>
            Recovery
          </strong>

          <small>
            {status === 'ready'
              ? lastSyncLabel
                ? 'Synced ' +
                  lastSyncLabel
                : 'Firestore ready'
              : status === 'error'
                ? 'Open for details'
                : 'Connecting Firebase'}
          </small>
        </span>
      </button>

      {drawerOpen ? (
        <div
          className="cloud-recovery-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setDrawerOpen(false);
            }
          }}
        >
          <aside
            ref={drawerRef}
            id="cloud-recovery-dialog"
            className="cloud-recovery-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Cloud backup and recovery"
            tabIndex={-1}
          >
            <header className="cloud-recovery-head">
              <div>
                <span className="cloud-recovery-head-icon">
                  <DatabaseBackup size={18} />
                </span>

                <div>
                  <span className="cloud-recovery-kicker">
                    FIREBASE / FIRESTORE
                  </span>
                  <h2>Cloud recovery</h2>
                  <p>
                    Local autosave stays active.
                    Firestore adds a protected cloud
                    copy and immutable safety snapshots.
                  </p>
                </div>
              </div>

              <button
                ref={closeRef}
                type="button"
                title="Close"
                onClick={() =>
                  setDrawerOpen(false)
                }
              >
                <X size={16} />
              </button>
            </header>

            <div className="cloud-recovery-status-card">
              <span
                className="cloud-recovery-status-icon"
                data-status={status}
              >
                {status === 'error' ? (
                  <CloudOff size={17} />
                ) : (
                  <ShieldCheck size={17} />
                )}
              </span>

              <div>
                <strong>
                  {status === 'ready'
                    ? 'Workspace protected'
                    : status === 'error'
                      ? 'Cloud unavailable — local draft preserved'
                      : 'Preparing cloud protection'}
                </strong>
                <span>
                  {uid
                    ? 'Firebase UID ' +
                      shortUid(uid)
                    : 'Authenticating securely…'}
                </span>
              </div>

              <button
                type="button"
                disabled={!uid}
                onClick={() =>
                  void manualSync()
                }
              >
                <RefreshCw size={13} />
                Sync now
              </button>
            </div>

            {errorMessage ? (
              <div className="cloud-recovery-error">
                <CloudOff size={14} />
                <div>
                  <strong>
                    Firebase needs attention
                  </strong>
                  <span>{errorMessage}</span>
                </div>
              </div>
            ) : null}

            <section className="cloud-recovery-section">
              <div className="cloud-recovery-section-head">
                <div>
                  <span>CURRENT CLOUD STATE</span>
                  <strong>Full workspace copy</strong>
                </div>

                {cloudWorkspaceAvailable ? (
                  <span className="cloud-recovery-available">
                    <Check size={11} />
                    AVAILABLE
                  </span>
                ) : null}
              </div>

              <p>
                Restore the last cloud workspace if
                the local browser draft was overwritten.
              </p>

              <button
                className="cloud-recovery-primary"
                type="button"
                disabled={
                  !uid ||
                  !cloudWorkspaceAvailable
                }
                onClick={() =>
                  void restoreCurrentCloud()
                }
              >
                <RotateCcw size={14} />
                Restore cloud workspace
              </button>
            </section>

            <section className="cloud-recovery-section cloud-recovery-snapshot-section">
              <div className="cloud-recovery-section-head">
                <div>
                  <span>SAFETY HISTORY</span>
                  <strong>Recovery snapshots</strong>
                </div>
                <span className="cloud-recovery-count">
                  {snapshots.length}
                </span>
              </div>

              <p>
                Reset, Clear, and destructive data
                reductions preserve the previous active
                incident here before cloud state changes.
              </p>

              <div className="cloud-recovery-snapshot-list">
                {snapshots.map((snapshot) => (
                  <article key={snapshot.id}>
                    <div className="cloud-recovery-snapshot-main">
                      <span>
                        {formatSnapshotDate(
                          snapshot.clientCreatedAt
                        )}
                      </span>
                      <strong>
                        {snapshot.ticket ||
                          snapshot.region ||
                          'Untitled incident'}
                      </strong>
                      <p>
                        {snapshot.summary ||
                          snapshot.reason}
                      </p>
                      <small>
                        {snapshot.progressCount}{' '}
                        updates · {snapshot.reason}
                      </small>
                    </div>

                    <div className="cloud-recovery-snapshot-actions">
                      <button
                        type="button"
                        onClick={() =>
                          void restoreSnapshot(
                            snapshot.id
                          )
                        }
                      >
                        <RotateCcw size={12} />
                        Restore
                      </button>

                      <button
                        className="cloud-recovery-delete"
                        type="button"
                        title="Delete snapshot"
                        onClick={() =>
                          void removeSnapshot(
                            snapshot.id
                          )
                        }
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </article>
                ))}

                {snapshots.length === 0 ? (
                  <div className="cloud-recovery-empty">
                    <ShieldCheck size={20} />
                    <strong>
                      No recovery snapshot yet
                    </strong>
                    <span>
                      Current cloud autosave is already
                      active. Safety history appears after
                      a protected destructive action.
                    </span>
                  </div>
                ) : null}
              </div>
            </section>

            <footer className="cloud-recovery-footnote">
              Anonymous Firebase Auth protects this
              browser with its own UID. For cross-device
              recovery later, link this anonymous account
              to a permanent sign-in provider instead of
              clearing browser/site identity.
            </footer>
          </aside>
        </div>
      ) : null}
    </>
  );
}
