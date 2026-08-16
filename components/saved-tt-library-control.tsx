'use client';

import {
  Archive,
  Check,
  ChevronRight,
  Cloud,
  FolderOpen,
  LoaderCircle,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  createPortal,
} from 'react-dom';

import styles from './saved-tt-library-control.module.css';

import {
  deleteSavedTT,
  loadSavedTTById,
  loadSavedTTLibrary,
  saveTTToLibrary,
  SavedTTClientError,
  type SavedTTSummary,
} from '@/lib/saved-tt-client';

import {
  deserializeWorkspace,
  serializeWorkspace,
  type IncidentRecord,
} from '@/lib/workspace';

const WORKSPACE_STORAGE_KEY =
  'reportos:workspace:v1';
const LEGACY_DRAFT_KEY =
  'reportos:draft:v1';

type WorkspaceMode =
  | 'compose'
  | 'archive'
  | 'other';

function formatSavedTime(
  value: number
): string {
  return new Intl.DateTimeFormat(
    'en-GB',
    {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }
  ).format(new Date(value));
}

function readCurrentIncident():
  IncidentRecord | null {
  const workspace =
    deserializeWorkspace(
      window.localStorage.getItem(
        WORKSPACE_STORAGE_KEY
      )
    );

  if (!workspace) {
    return null;
  }

  return (
    workspace.incidents.find(
      (incident) =>
        incident.id ===
        workspace.activeIncidentId
    ) ?? null
  );
}

export function SavedTTLibraryControl() {
  const [mode, setMode] =
    useState<WorkspaceMode>('other');
  const [topbarTarget, setTopbarTarget] =
    useState<HTMLElement | null>(null);
  const [panelOpen, setPanelOpen] =
    useState(false);
  const [records, setRecords] =
    useState<SavedTTSummary[]>([]);
  const [libraryRevision, setLibraryRevision] =
    useState(0);
  const [busy, setBusy] =
    useState(false);
  const [message, setMessage] =
    useState('Saved TT is stored in Cloudflare D1.');
  const [lastSavedId, setLastSavedId] =
    useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const syncTargets = () => {
      if (cancelled) {
        return;
      }

      const shell =
        document.querySelector<HTMLElement>(
          '.app-shell'
        );

      const rawMode =
        shell?.dataset.workspaceMode;

      setMode(
        rawMode === 'compose' ||
        rawMode === 'archive'
          ? rawMode
          : 'other'
      );

      setTopbarTarget(
        shell?.querySelector<HTMLElement>(
          '.topbar-actions'
        ) ?? null
      );
    };

    const initial =
      window.setTimeout(
        syncTargets,
        0
      );

    const observer =
      new MutationObserver(
        syncTargets
      );

    observer.observe(
      document.body,
      {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: [
          'data-workspace-mode',
        ],
      }
    );

    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!panelOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      'hidden';

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key === 'Escape') {
        setPanelOpen(false);
        setDeleteConfirmId(null);
      }
    };

    document.addEventListener(
      'keydown',
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        'keydown',
        handleKeyDown
      );
      document.body.style.overflow =
        previousOverflow;
    };
  }, [panelOpen]);

  const refreshLibrary =
    useCallback(async () => {
      setBusy(true);

      try {
        const library =
          await loadSavedTTLibrary();

        setRecords(library.records);
        setLibraryRevision(
          library.libraryRevision
        );
        setMessage(
          `${library.records.length} saved TT record${library.records.length === 1 ? '' : 's'} synced from D1.`
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : 'Saved TT library is unavailable.'
        );
      } finally {
        setBusy(false);
      }
    }, []);

  const saveCurrentTT =
    useCallback(async () => {
      setBusy(true);

      try {
        await new Promise<void>(
          (resolve) =>
            window.requestAnimationFrame(
              () => resolve()
            )
        );

        const incident =
          readCurrentIncident();

        if (!incident) {
          throw new Error(
            'No active Composer incident is available to save.'
          );
        }

        const library =
          await loadSavedTTLibrary();

        const saved =
          await saveTTToLibrary({
            incident,
            expectedLibraryRevision:
              library.libraryRevision,
          });

        setRecords(saved.records);
        setLibraryRevision(
          saved.libraryRevision
        );
        setLastSavedId(
          saved.recordMeta.id
        );
        setMessage(
          `Saved “${saved.recordMeta.name}” to the cloud Saved TT library.`
        );
      } catch (error) {
        if (
          error instanceof SavedTTClientError &&
          error.code === 'REVISION_CONFLICT'
        ) {
          setMessage(
            'Saved TT library changed in another session. Try Save TT again.'
          );
        } else {
          setMessage(
            error instanceof Error
              ? error.message
              : 'Current TT could not be saved.'
          );
        }
      } finally {
        setBusy(false);
      }
    }, []);

  const openLibrary =
    useCallback(() => {
      setPanelOpen(true);
      setDeleteConfirmId(null);
      void refreshLibrary();
    }, [refreshLibrary]);

  const openSavedTT =
    useCallback(
      async (incidentId: string) => {
        setBusy(true);

        try {
          const detail =
            await loadSavedTTById(
              incidentId
            );

          const current =
            deserializeWorkspace(
              window.localStorage.getItem(
                WORKSPACE_STORAGE_KEY
              )
            );

          const incidents = current
            ? current.incidents.some(
                (incident) =>
                  incident.id ===
                  detail.incident.id
              )
              ? current.incidents.map(
                  (incident) =>
                    incident.id ===
                    detail.incident.id
                      ? detail.incident
                      : incident
                )
              : [
                  detail.incident,
                  ...current.incidents,
                ]
            : [detail.incident];

          window.localStorage.setItem(
            WORKSPACE_STORAGE_KEY,
            serializeWorkspace({
              version: 1,
              activeIncidentId:
                detail.incident.id,
              incidents,
            })
          );

          window.localStorage.setItem(
            LEGACY_DRAFT_KEY,
            JSON.stringify(
              detail.incident.report
            )
          );

          window.location.assign(
            '/?workspace=composer'
          );
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : 'Saved TT could not be opened.'
          );
          setBusy(false);
        }
      },
      []
    );

  const removeSavedTT =
    useCallback(
      async (incidentId: string) => {
        if (
          deleteConfirmId !== incidentId
        ) {
          setDeleteConfirmId(incidentId);
          return;
        }

        setBusy(true);

        try {
          const next =
            await deleteSavedTT({
              incidentId,
              expectedLibraryRevision:
                libraryRevision,
            });

          setRecords(next.records);
          setLibraryRevision(
            next.libraryRevision
          );
          setDeleteConfirmId(null);
          setMessage(
            'Saved TT removed from the cloud library.'
          );
        } catch (error) {
          if (
            error instanceof SavedTTClientError &&
            error.code === 'REVISION_CONFLICT'
          ) {
            setMessage(
              'Saved TT library changed in another session. Refresh the library first.'
            );
          } else {
            setMessage(
              error instanceof Error
                ? error.message
                : 'Saved TT could not be deleted.'
            );
          }
        } finally {
          setBusy(false);
        }
      },
      [
        deleteConfirmId,
        libraryRevision,
      ]
    );

  const composerButton =
    mode === 'compose' &&
    topbarTarget
      ? createPortal(
          <button
            className={styles.saveButton}
            data-saved={
              lastSavedId
                ? 'true'
                : 'false'
            }
            type="button"
            disabled={busy}
            title="Save the current incident as a reusable cloud Saved TT record"
            onClick={() =>
              void saveCurrentTT()
            }
          >
            {busy ? (
              <LoaderCircle
                className={styles.spinner}
                size={15}
              />
            ) : lastSavedId ? (
              <Check size={15} />
            ) : (
              <Save size={15} />
            )}
            {busy
              ? 'Saving…'
              : lastSavedId
                ? 'Saved TT'
                : 'Save TT'}
          </button>,
          topbarTarget
        )
      : null;

  const archiveButton =
    mode === 'archive' &&
    topbarTarget
      ? createPortal(
          <button
            className={styles.libraryButton}
            type="button"
            onClick={openLibrary}
          >
            <Archive size={15} />
            Saved TT
            {records.length > 0 ? (
              <span>{records.length}</span>
            ) : null}
          </button>,
          topbarTarget
        )
      : null;

  return (
    <>
      {composerButton}
      {archiveButton}

      {panelOpen ? (
        <div
          className={styles.backdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setPanelOpen(false);
              setDeleteConfirmId(null);
            }
          }}
        >
          <section
            className={styles.libraryPanel}
            role="dialog"
            aria-modal="true"
            aria-label="Saved TT library"
          >
            <header className={styles.panelHeader}>
              <div className={styles.panelTitle}>
                <span className={styles.panelIcon}>
                  <Cloud size={17} />
                </span>
                <span>
                  <strong>Saved TT library</strong>
                  <small>{message}</small>
                </span>
              </div>

              <div className={styles.headerActions}>
                <button
                  type="button"
                  disabled={busy}
                  title="Refresh Saved TT library"
                  onClick={() =>
                    void refreshLibrary()
                  }
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  type="button"
                  aria-label="Close Saved TT library"
                  onClick={() => {
                    setPanelOpen(false);
                    setDeleteConfirmId(null);
                  }}
                >
                  <X size={15} />
                </button>
              </div>
            </header>

            <div className={styles.libraryMeta}>
              <span>
                <FolderOpen size={13} />
                {records.length} cloud record{records.length === 1 ? '' : 's'}
              </span>
              <span>
                D1 revision {libraryRevision}
              </span>
            </div>

            <div className={styles.recordList}>
              {busy && records.length === 0 ? (
                <div className={styles.emptyState}>
                  <LoaderCircle
                    className={styles.spinner}
                    size={20}
                  />
                  <strong>Loading Saved TT…</strong>
                </div>
              ) : records.length === 0 ? (
                <div className={styles.emptyState}>
                  <Archive size={21} />
                  <strong>No Saved TT yet</strong>
                  <small>
                    Open Composer and click Save TT to create your first cloud record.
                  </small>
                </div>
              ) : (
                records.map((record) => (
                  <article
                    className={styles.record}
                    key={record.id}
                  >
                    <div className={styles.recordMain}>
                      <span className={styles.recordStatus}>
                        {record.status}
                      </span>
                      <strong>{record.name}</strong>
                      <small>
                        {record.region || 'UNASSIGNED'}
                        {' · '}
                        {record.pic || 'No PIC'}
                      </small>
                      <p>
                        {record.summary || 'No incident summary yet.'}
                      </p>
                    </div>

                    <div className={styles.recordTelemetry}>
                      <span>
                        <small>UPDATES</small>
                        <strong>{record.progressCount}</strong>
                      </span>
                      <span>
                        <small>SAVED</small>
                        <strong>
                          {formatSavedTime(record.savedAt)}
                        </strong>
                      </span>
                    </div>

                    <div className={styles.recordActions}>
                      <button
                        className={styles.deleteButton}
                        data-confirm={
                          deleteConfirmId === record.id
                            ? 'true'
                            : 'false'
                        }
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void removeSavedTT(record.id)
                        }
                      >
                        <Trash2 size={13} />
                        {deleteConfirmId === record.id
                          ? 'Confirm'
                          : 'Delete'}
                      </button>
                      <button
                        className={styles.openButton}
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void openSavedTT(record.id)
                        }
                      >
                        Open TT
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
