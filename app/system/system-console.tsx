'use client';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import Link from 'next/link';

import {
  Activity,
  ArrowLeft,
  Database,
  History,
  ShieldCheck,
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

function timeLabel(
  value: number | null
): string {
  if (!value) {
    return 'Never';
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    }
  ).format(
    new Date(value)
  );
}

function bytesLabel(
  value: number
): string {
  if (value < 1_024) {
    return `${value} B`;
  }

  if (value < 1_048_576) {
    return `${(value / 1_024).toFixed(1)} KB`;
  }

  return `${(value / 1_048_576).toFixed(1)} MB`;
}

export function SystemConsole() {
  const [
    session,
    setSession,
  ] = useState<SystemSession | null>(
    null
  );

  const [
    canonical,
    setCanonical,
  ] = useState<CanonicalStatus | null>(
    null
  );

  const [
    snapshots,
    setSnapshots,
  ] = useState<RecoverySnapshot[]>(
    []
  );

  const [
    audit,
    setAudit,
  ] = useState<AuditEvent[]>(
    []
  );

  const [loading, setLoading] =
    useState(true);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  const [
    restoringId,
    setRestoringId,
  ] = useState<string | null>(
    null
  );

  const [
    confirmId,
    setConfirmId,
  ] = useState<string | null>(
    null
  );

  const refresh =
    useCallback(
      async () => {
        setError(null);

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
          setCanonical(
            nextCanonical
          );
          setSnapshots(
            nextSnapshots
          );
          setAudit(nextAudit);
        } catch (loadError) {
          if (
            loadError instanceof
            AdminClientError
          ) {
            setError(
              `${loadError.code}: ${loadError.message}`
            );
          } else {
            setError(
              'System console could not load.'
            );
          }
        } finally {
          setLoading(false);
        }
      },
      []
    );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const restore = async (
    snapshotId: string
  ) => {
    setRestoringId(snapshotId);
    setError(null);

    try {
      await restoreRecoverySnapshot(
        snapshotId
      );

      setConfirmId(null);
      await refresh();

      window.location.href = '/';
    } catch (restoreError) {
      setError(
        restoreError instanceof Error
          ? restoreError.message
          : 'Recovery restore failed.'
      );
    } finally {
      setRestoringId(null);
    }
  };

  if (
    loading &&
    !session
  ) {
    return (
      <div className={styles.page}>
        <div
          className={styles.loading}
        >
          Opening ReportOS System Console…
        </div>
      </div>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <div>
            <Link
              className={styles.back}
              href="/"
            >
              <ArrowLeft size={13} />
              Back to Operations
            </Link>

            <span
              className={styles.eyebrow}
              style={{
                marginTop: 18,
              }}
            >
              REPORTOS CONTROL PLANE
            </span>

            <h1 className={styles.title}>
              System Console
            </h1>

            <p
              className={styles.subtitle}
            >
              Identity, canonical database state, recovery snapshots and immutable operational audit history.
            </p>
          </div>

          <div className={styles.status}>
            <span
              className={styles.statusDot}
            />
            Authenticated control plane
          </div>
        </div>

        {error ? (
          <div className={styles.error}>
            {error}
          </div>
        ) : null}

        <section className={styles.grid}>
          <div className={styles.card}>
            <span
              className={styles.cardLabel}
            >
              IDENTITY
            </span>
            <strong
              className={styles.cardValue}
            >
              {session?.user.anonymous
                ? 'Anonymous'
                : session?.user.provider ??
                  'Unknown'}
            </strong>
            <span
              className={styles.cardDetail}
            >
              {session?.user.email ??
                session?.user.uid ??
                'Unavailable'}
            </span>
          </div>

          <div className={styles.card}>
            <span
              className={styles.cardLabel}
            >
              WORKSPACE ROLE
            </span>
            <strong
              className={styles.cardValue}
            >
              {session?.workspace.role ??
                '—'}
            </strong>
            <span
              className={styles.cardDetail}
            >
              {session?.workspace.name ??
                'ReportOS Workspace'}
            </span>
          </div>

          <div className={styles.card}>
            <span
              className={styles.cardLabel}
            >
              CANONICAL REVISION
            </span>
            <strong
              className={styles.cardValue}
            >
              {canonical?.revision ?? 0}
            </strong>
            <span
              className={styles.cardDetail}
            >
              {canonical?.incidentCount ?? 0} incidents · {timeLabel(canonical?.updatedAt ?? null)}
            </span>
          </div>

          <div className={styles.card}>
            <span
              className={styles.cardLabel}
            >
              RECOVERY POINTS
            </span>
            <strong
              className={styles.cardValue}
            >
              {snapshots.length}
            </strong>
            <span
              className={styles.cardDetail}
            >
              D1 safety history
            </span>
          </div>
        </section>

        <div className={styles.columns}>
          <section className={styles.section}>
            <div
              className={styles.sectionHeader}
            >
              <div>
                <h2>
                  <History
                    size={13}
                    style={{
                      marginRight: 6,
                      verticalAlign:
                        'text-bottom',
                    }}
                  />
                  Recovery history
                </h2>
                <p>
                  Canonical snapshots taken before destructive or revision-changing operations.
                </p>
              </div>
              <span className={styles.count}>
                {snapshots.length}
              </span>
            </div>

            <div className={styles.list}>
              {snapshots.length > 0 ? (
                snapshots.map(
                  (snapshot) => (
                    <div key={snapshot.id}>
                      <div
                        className={styles.row}
                      >
                        <div>
                          <strong>
                            {snapshot.reason}
                          </strong>
                          <span>
                            {timeLabel(snapshot.createdAt)} · {bytesLabel(snapshot.payloadBytes)}
                          </span>
                        </div>

                        <button
                          type="button"
                          disabled={
                            restoringId ===
                            snapshot.id
                          }
                          onClick={() =>
                            setConfirmId(
                              snapshot.id
                            )
                          }
                        >
                          Restore
                        </button>
                      </div>

                      {confirmId ===
                      snapshot.id ? (
                        <div
                          className={styles.confirm}
                        >
                          Restoring creates a new safety snapshot of the current canonical workspace first. Continue?
                          <div
                            className={styles.confirmActions}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmId(null)
                              }
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void restore(
                                  snapshot.id
                                );
                              }}
                            >
                              Restore snapshot
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                )
              ) : (
                <div
                  className={styles.empty}
                >
                  No D1 recovery snapshot yet.
                </div>
              )}
            </div>
          </section>

          <section className={styles.section}>
            <div
              className={styles.sectionHeader}
            >
              <div>
                <h2>
                  <Activity
                    size={13}
                    style={{
                      marginRight: 6,
                      verticalAlign:
                        'text-bottom',
                    }}
                  />
                  Audit trail
                </h2>
                <p>
                  Latest server-side workspace mutations with actor and request correlation.
                </p>
              </div>
              <span className={styles.count}>
                {audit.length}
              </span>
            </div>

            <div className={styles.list}>
              {audit.length > 0 ? (
                audit.map((event) => (
                  <div
                    className={styles.row}
                    key={event.id}
                  >
                    <div>
                      <strong>
                        {event.action}
                      </strong>
                      <span>
                        {timeLabel(event.createdAt)} · {event.actorUid.slice(0, 14)}…
                      </span>
                    </div>
                    <Database size={14} />
                  </div>
                ))
              ) : (
                <div
                  className={styles.empty}
                >
                  No server audit event yet.
                </div>
              )}
            </div>
          </section>
        </div>

        <section
          className={styles.section}
          style={{
            marginTop: 12,
          }}
        >
          <div
            className={styles.sectionHeader}
          >
            <div>
              <h2>
                <ShieldCheck
                  size={13}
                  style={{
                    marginRight: 6,
                    verticalAlign:
                      'text-bottom',
                  }}
                />
                Governance status
              </h2>
              <p>
                Server identity and authorization are derived from Firebase-authenticated requests; D1 access remains server-only.
              </p>
            </div>
          </div>

          <div className={styles.list}>
            <div className={styles.row}>
              <div>
                <strong>
                  Canonical checksum
                </strong>
                <span>
                  {canonical?.checksum ??
                    'No canonical state yet'}
                </span>
              </div>
            </div>
            <div className={styles.row}>
              <div>
                <strong>
                  Last writer
                </strong>
                <span>
                  {canonical?.updatedBy ??
                    'No canonical writer yet'}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
