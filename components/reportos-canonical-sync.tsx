'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  deserializeWorkspace,
  serializeWorkspace,
  type WorkspaceSnapshot,
} from '@/lib/workspace';

import {
  loadServerWorkspace,
  ReportOsServerError,
  saveServerWorkspace,
  type ServerSyncState,
  type ServerWorkspaceEnvelope,
} from '@/lib/reportos-server-client';

import styles from './reportos-canonical-sync.module.css';

const WORKSPACE_STORAGE_KEY =
  'reportos:workspace:v1';

const SYNC_META_KEY =
  'reportos:canonical-sync:v1';

const SERVER_POLL_MS =
  5_000;

const LOCAL_POLL_MS =
  800;

const SAVE_DEBOUNCE_MS =
  450;

type SyncMeta = {
  revision: number;
  serverChecksum: string | null;
  localChecksum: string | null;
};

function readLocalWorkspace(): {
  raw: string | null;
  workspace: WorkspaceSnapshot | null;
} {
  const raw =
    window.localStorage.getItem(
      WORKSPACE_STORAGE_KEY
    );

  return {
    raw,
    workspace:
      deserializeWorkspace(raw),
  };
}

function readSyncMeta(): SyncMeta {
  try {
    const raw =
      window.localStorage.getItem(
        SYNC_META_KEY
      );

    if (!raw) {
      throw new Error(
        'missing metadata'
      );
    }

    const parsed =
      JSON.parse(raw) as
        Partial<SyncMeta>;

    return {
      revision:
        typeof parsed.revision ===
        'number'
          ? parsed.revision
          : 0,
      serverChecksum:
        typeof parsed.serverChecksum ===
        'string'
          ? parsed.serverChecksum
          : null,
      localChecksum:
        typeof parsed.localChecksum ===
        'string'
          ? parsed.localChecksum
          : null,
    };
  } catch {
    return {
      revision: 0,
      serverChecksum: null,
      localChecksum: null,
    };
  }
}

function writeSyncMeta(
  meta: SyncMeta
) {
  window.localStorage.setItem(
    SYNC_META_KEY,
    JSON.stringify(meta)
  );
}

async function sha256(
  value: string | null
): Promise<string | null> {
  if (value === null) {
    return null;
  }

  const digest =
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(
        value
      )
    );

  return Array.from(
    new Uint8Array(digest)
  )
    .map((byte) =>
      byte
        .toString(16)
        .padStart(2, '0')
    )
    .join('');
}

function labelForState(
  state: ServerSyncState
): string {
  switch (state) {
    case 'connecting':
      return 'SERVER CONNECTING';
    case 'saving':
      return 'SERVER SAVING';
    case 'synced':
      return 'SERVER SYNCED';
    case 'offline':
      return 'OFFLINE CACHE';
    case 'conflict':
      return 'SYNC CONFLICT';
    case 'unavailable':
      return 'SERVER STANDBY';
  }
}

function detailForState({
  state,
  revision,
}: {
  state: ServerSyncState;
  revision: number;
}): string {
  switch (state) {
    case 'connecting':
      return 'Verifying identity and canonical state';
    case 'saving':
      return `Writing revision ${revision + 1}`;
    case 'synced':
      return revision > 0
        ? `D1 canonical revision ${revision}`
        : 'Ready for first canonical save';
    case 'offline':
      return 'Local safety cache remains active';
    case 'conflict':
      return 'Local and server both changed';
    case 'unavailable':
      return 'Local + Firestore safety layers remain active';
  }
}

export function ReportOsCanonicalSync() {
  const [
    state,
    setState,
  ] = useState<ServerSyncState>(
    'connecting'
  );

  const [
    revision,
    setRevision,
  ] = useState(0);

  const mountedRef =
    useRef(true);

  const revisionRef =
    useRef(0);

  const serverChecksumRef =
    useRef<string | null>(
      null
    );

  const syncedLocalChecksumRef =
    useRef<string | null>(
      null
    );

  const saveTimerRef =
    useRef<number | null>(
      null
    );

  const savingRef =
    useRef(false);

  const conflictServerRef =
    useRef<ServerWorkspaceEnvelope | null>(
      null
    );

  const updateRevision =
    useCallback(
      (next: number) => {
        revisionRef.current =
          next;

        if (mountedRef.current) {
          setRevision(next);
        }
      },
      []
    );

  const updateState =
    useCallback(
      (next: ServerSyncState) => {
        if (mountedRef.current) {
          setState(next);
        }
      },
      []
    );

  const rememberSynced =
    useCallback(
      ({
        server,
        localChecksum,
      }: {
        server: ServerWorkspaceEnvelope;
        localChecksum: string | null;
      }) => {
        updateRevision(
          server.revision
        );

        serverChecksumRef.current =
          server.checksum;

        syncedLocalChecksumRef.current =
          localChecksum;

        writeSyncMeta({
          revision:
            server.revision,
          serverChecksum:
            server.checksum,
          localChecksum,
        });
      },
      [updateRevision]
    );

  const applyServerAndReload =
    useCallback(
      async (
        server: ServerWorkspaceEnvelope
      ) => {
        if (!server.workspace) {
          return;
        }

        const raw =
          serializeWorkspace(
            server.workspace
          );

        const localChecksum =
          await sha256(raw);

        window.localStorage.setItem(
          WORKSPACE_STORAGE_KEY,
          raw
        );

        rememberSynced({
          server,
          localChecksum,
        });

        window.sessionStorage.setItem(
          'reportos:canonical-reload',
          String(server.revision)
        );

        window.location.reload();
      },
      [rememberSynced]
    );

  const pushLocal =
    useCallback(
      async ({
        workspace,
        raw,
        expectedRevision,
        reason,
      }: {
        workspace: WorkspaceSnapshot;
        raw: string;
        expectedRevision: number;
        reason: string;
      }) => {
        if (savingRef.current) {
          return;
        }

        savingRef.current = true;
        updateState('saving');

        try {
          const saved =
            await saveServerWorkspace({
              workspace,
              expectedRevision,
              reason,
            });

          const localChecksum =
            await sha256(raw);

          rememberSynced({
            server: saved,
            localChecksum,
          });

          conflictServerRef.current =
            null;

          updateState('synced');
        } catch (error) {
          if (
            error instanceof
              ReportOsServerError &&
            error.code ===
              'REVISION_CONFLICT'
          ) {
            try {
              const server =
                await loadServerWorkspace();

              conflictServerRef.current =
                server;

              updateRevision(
                server.revision
              );
            } catch {
              // Preserve local state and surface the conflict.
            }

            updateState('conflict');
          } else if (
            !navigator.onLine
          ) {
            updateState('offline');
          } else if (
            error instanceof
              ReportOsServerError &&
            error.code ===
              'DATABASE_UNAVAILABLE'
          ) {
            updateState('unavailable');
          } else {
            updateState('unavailable');
          }
        } finally {
          savingRef.current = false;
        }
      },
      [
        rememberSynced,
        updateRevision,
        updateState,
      ]
    );

  const bootstrap =
    useCallback(
      async () => {
        if (!navigator.onLine) {
          updateState('offline');
          return;
        }

        updateState('connecting');

        try {
          const [
            server,
            local,
          ] = await Promise.all([
            loadServerWorkspace(),
            Promise.resolve(
              readLocalWorkspace()
            ),
          ]);

          const localChecksum =
            await sha256(
              local.raw
            );

          const meta =
            readSyncMeta();

          updateRevision(
            server.revision
          );

          if (!server.workspace) {
            if (
              local.workspace &&
              local.raw
            ) {
              await pushLocal({
                workspace:
                  local.workspace,
                raw:
                  local.raw,
                expectedRevision: 0,
                reason:
                  'Initial local-to-D1 migration',
              });
            } else {
              rememberSynced({
                server,
                localChecksum,
              });
              updateState('synced');
            }

            return;
          }

          const serverRaw =
            serializeWorkspace(
              server.workspace
            );

          const effectiveServerChecksum =
            server.checksum ??
            (await sha256(
              serverRaw
            ));

          const localChangedSinceSync =
            Boolean(
              meta.localChecksum &&
              localChecksum &&
              meta.localChecksum !==
                localChecksum
            );

          const serverChangedSinceSync =
            Boolean(
              meta.serverChecksum &&
              effectiveServerChecksum &&
              meta.serverChecksum !==
                effectiveServerChecksum
            );

          if (!local.workspace) {
            await applyServerAndReload(
              {
                ...server,
                checksum:
                  effectiveServerChecksum,
              }
            );
            return;
          }

          if (
            localChecksum ===
            effectiveServerChecksum
          ) {
            rememberSynced({
              server: {
                ...server,
                checksum:
                  effectiveServerChecksum,
              },
              localChecksum,
            });
            updateState('synced');
            return;
          }

          if (
            meta.revision > 0 &&
            localChangedSinceSync &&
            !serverChangedSinceSync
          ) {
            await pushLocal({
              workspace:
                local.workspace,
              raw:
                local.raw ??
                serializeWorkspace(
                  local.workspace
                ),
              expectedRevision:
                server.revision,
              reason:
                'Offline/local changes reconciled to D1',
            });
            return;
          }

          if (
            meta.revision > 0 &&
            localChangedSinceSync &&
            serverChangedSinceSync
          ) {
            conflictServerRef.current =
              server;
            updateState('conflict');
            return;
          }

          await applyServerAndReload(
            {
              ...server,
              checksum:
                effectiveServerChecksum,
            }
          );
        } catch (error) {
          if (!navigator.onLine) {
            updateState('offline');
          } else if (
            error instanceof
              ReportOsServerError &&
            error.code ===
              'DATABASE_UNAVAILABLE'
          ) {
            updateState('unavailable');
          } else {
            updateState('unavailable');
          }
        }
      },
      [
        applyServerAndReload,
        pushLocal,
        rememberSynced,
        updateRevision,
        updateState,
      ]
    );

  const scheduleLocalSave =
    useCallback(
      async () => {
        if (
          state === 'conflict' ||
          state === 'connecting'
        ) {
          return;
        }

        const local =
          readLocalWorkspace();

        if (
          !local.workspace ||
          !local.raw
        ) {
          return;
        }

        const localChecksum =
          await sha256(
            local.raw
          );

        if (
          localChecksum ===
          syncedLocalChecksumRef.current
        ) {
          return;
        }

        if (!navigator.onLine) {
          updateState('offline');
          return;
        }

        if (
          saveTimerRef.current !==
          null
        ) {
          window.clearTimeout(
            saveTimerRef.current
          );
        }

        saveTimerRef.current =
          window.setTimeout(
            () => {
              void pushLocal({
                workspace:
                  local.workspace as WorkspaceSnapshot,
                raw:
                  local.raw as string,
                expectedRevision:
                  revisionRef.current,
                reason:
                  'Canonical workspace autosave',
              });
            },
            SAVE_DEBOUNCE_MS
          );
      },
      [
        pushLocal,
        state,
        updateState,
      ]
    );

  const pollServer =
    useCallback(
      async () => {
        if (
          !navigator.onLine ||
          savingRef.current ||
          state === 'conflict'
        ) {
          return;
        }

        try {
          const server =
            await loadServerWorkspace();

          if (
            server.revision <=
            revisionRef.current
          ) {
            if (
              state !== 'synced' &&
              state !== 'saving'
            ) {
              updateState('synced');
            }
            return;
          }

          const local =
            readLocalWorkspace();

          const localChecksum =
            await sha256(
              local.raw
            );

          const localIsDirty =
            localChecksum !==
            syncedLocalChecksumRef.current;

          if (localIsDirty) {
            conflictServerRef.current =
              server;
            updateRevision(
              server.revision
            );
            updateState('conflict');
            return;
          }

          await applyServerAndReload(
            server
          );
        } catch (error) {
          if (!navigator.onLine) {
            updateState('offline');
          } else if (
            error instanceof
              ReportOsServerError &&
            error.code ===
              'DATABASE_UNAVAILABLE'
          ) {
            updateState('unavailable');
          }
        }
      },
      [
        applyServerAndReload,
        state,
        updateRevision,
        updateState,
      ]
    );

  const useServerVersion =
    useCallback(
      async () => {
        const server =
          conflictServerRef.current ??
          (await loadServerWorkspace());

        await applyServerAndReload(
          server
        );
      },
      [applyServerAndReload]
    );

  const keepLocalVersion =
    useCallback(
      async () => {
        const local =
          readLocalWorkspace();

        if (
          !local.workspace ||
          !local.raw
        ) {
          return;
        }

        const latest =
          await loadServerWorkspace();

        await pushLocal({
          workspace:
            local.workspace,
          raw:
            local.raw,
          expectedRevision:
            latest.revision,
          reason:
            'Manual conflict resolution: keep local',
        });
      },
      [pushLocal]
    );

  useEffect(() => {
    mountedRef.current = true;

    void bootstrap();

    const localTimer =
      window.setInterval(
        () => {
          void scheduleLocalSave();
        },
        LOCAL_POLL_MS
      );

    const serverTimer =
      window.setInterval(
        () => {
          void pollServer();
        },
        SERVER_POLL_MS
      );

    const handleOnline = () => {
      void bootstrap();
    };

    const handleOffline = () => {
      updateState('offline');
    };

    window.addEventListener(
      'online',
      handleOnline
    );

    window.addEventListener(
      'offline',
      handleOffline
    );

    return () => {
      mountedRef.current = false;

      window.clearInterval(
        localTimer
      );

      window.clearInterval(
        serverTimer
      );

      if (
        saveTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          saveTimerRef.current
        );
      }

      window.removeEventListener(
        'online',
        handleOnline
      );

      window.removeEventListener(
        'offline',
        handleOffline
      );
    };
  }, [
    bootstrap,
    pollServer,
    scheduleLocalSave,
    updateState,
  ]);

  return (
    <aside
      className={`${styles.root} ${styles[state]}`}
      aria-live="polite"
      aria-label="ReportOS server sync status"
    >
      <span
        className={styles.dot}
        aria-hidden="true"
      />

      <div className={styles.copy}>
        <strong>
          {labelForState(state)}
        </strong>

        <span>
          {detailForState({
            state,
            revision,
          })}
        </span>
      </div>

      {state === 'conflict' ? (
        <div
          className={styles.actions}
        >
          <button
            type="button"
            onClick={() => {
              void useServerVersion();
            }}
          >
            Use server
          </button>

          <button
            type="button"
            onClick={() => {
              void keepLocalVersion();
            }}
          >
            Keep local
          </button>
        </div>
      ) : null}
    </aside>
  );
}
