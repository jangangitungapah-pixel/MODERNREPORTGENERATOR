'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ensureFirebaseUser,
} from '@/lib/firebase-client';

import {
  loadServerWorkspace,
  ReportOsServerError,
  saveServerWorkspace,
  type ServerSyncState,
  type ServerWorkspaceEnvelope,
} from '@/lib/reportos-server-client';

import {
  deserializeWorkspace,
  serializeWorkspace,
  type WorkspaceSnapshot,
} from '@/lib/workspace';

import styles from './reportos-canonical-sync.module.css';

const WORKSPACE_STORAGE_KEY =
  'reportos:workspace:v1';

const META_PREFIX =
  'reportos:canonical-sync:v2:';

const LOCAL_POLL_MS = 900;
const SERVER_POLL_MS = 5_000;
const SAVE_DEBOUNCE_MS = 450;

type SyncMeta = {
  uid: string;
  revision: number;
  serverChecksum: string | null;
  localChecksum: string | null;
};

type LocalWorkspace = {
  raw: string | null;
  workspace: WorkspaceSnapshot | null;
};

function localWorkspace(): LocalWorkspace {
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

function metaKey(
  uid: string
): string {
  return META_PREFIX + uid;
}

function readMeta(
  uid: string
): SyncMeta | null {
  try {
    const raw =
      window.localStorage.getItem(
        metaKey(uid)
      );

    if (!raw) {
      return null;
    }

    const value =
      JSON.parse(raw) as
        Partial<SyncMeta>;

    if (
      value.uid !== uid ||
      typeof value.revision !==
        'number'
    ) {
      return null;
    }

    return {
      uid,
      revision:
        value.revision,
      serverChecksum:
        typeof value.serverChecksum ===
        'string'
          ? value.serverChecksum
          : null,
      localChecksum:
        typeof value.localChecksum ===
        'string'
          ? value.localChecksum
          : null,
    };
  } catch {
    return null;
  }
}

function writeMeta(
  value: SyncMeta
): void {
  window.localStorage.setItem(
    metaKey(value.uid),
    JSON.stringify(value)
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

function stateLabel(
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

function stateDetail(
  state: ServerSyncState,
  revision: number
): string {
  switch (state) {
    case 'connecting':
      return 'Resolving authenticated canonical state';
    case 'saving':
      return `Writing revision ${revision + 1}`;
    case 'synced':
      return revision > 0
        ? `D1 canonical revision ${revision}`
        : 'Ready for first canonical revision';
    case 'offline':
      return 'Local safety cache remains active';
    case 'conflict':
      return 'Local and server both changed';
    case 'unavailable':
      return 'Local + Firestore safety layers remain active';
  }
}

export function ReportOsCanonicalSync() {
  const [state, setState] =
    useState<ServerSyncState>(
      'connecting'
    );

  const [revision, setRevision] =
    useState(0);

  const mountedRef =
    useRef(true);

  const uidRef =
    useRef<string | null>(null);

  const revisionRef =
    useRef(0);

  const syncedLocalChecksumRef =
    useRef<string | null>(null);

  const busyRef =
    useRef(false);

  const saveTimerRef =
    useRef<number | null>(null);

  const conflictRef =
    useRef<ServerWorkspaceEnvelope | null>(
      null
    );

  const channelRef =
    useRef<BroadcastChannel | null>(
      null
    );

  const safeSetState =
    useCallback(
      (next: ServerSyncState) => {
        if (mountedRef.current) {
          setState(next);
        }
      },
      []
    );

  const setKnownRevision =
    useCallback(
      (next: number) => {
        revisionRef.current = next;

        if (mountedRef.current) {
          setRevision(next);
        }
      },
      []
    );

  const remember =
    useCallback(
      ({
        server,
        localChecksum,
      }: {
        server: ServerWorkspaceEnvelope;
        localChecksum: string | null;
      }) => {
        const uid =
          uidRef.current;

        if (!uid) {
          return;
        }

        setKnownRevision(
          server.revision
        );

        syncedLocalChecksumRef.current =
          localChecksum;

        writeMeta({
          uid,
          revision:
            server.revision,
          serverChecksum:
            server.checksum,
          localChecksum,
        });

        channelRef.current?.postMessage({
          type: 'revision',
          revision:
            server.revision,
        });
      },
      [setKnownRevision]
    );

  const applyServerWorkspace =
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

        remember({
          server,
          localChecksum,
        });

        window.sessionStorage.setItem(
          'reportos:canonical-reload',
          String(server.revision)
        );

        window.location.reload();
      },
      [remember]
    );

  const saveLocalWorkspace =
    useCallback(
      async ({
        local,
        expectedRevision,
        reason,
      }: {
        local: LocalWorkspace;
        expectedRevision: number;
        reason: string;
      }) => {
        if (
          busyRef.current ||
          !local.workspace ||
          !local.raw
        ) {
          return;
        }

        busyRef.current = true;
        safeSetState('saving');

        try {
          const saved =
            await saveServerWorkspace({
              workspace:
                local.workspace,
              expectedRevision,
              reason,
            });

          const localChecksum =
            await sha256(
              local.raw
            );

          conflictRef.current = null;

          remember({
            server: saved,
            localChecksum,
          });

          safeSetState('synced');
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

              conflictRef.current =
                server;

              setKnownRevision(
                server.revision
              );
            } catch {
              // Local data remains untouched.
            }

            safeSetState('conflict');
          } else if (
            !navigator.onLine
          ) {
            safeSetState('offline');
          } else {
            safeSetState('unavailable');
          }
        } finally {
          busyRef.current = false;
        }
      },
      [
        remember,
        safeSetState,
        setKnownRevision,
      ]
    );

  const reconcile =
    useCallback(
      async () => {
        if (!navigator.onLine) {
          safeSetState('offline');
          return;
        }

        safeSetState('connecting');

        try {
          const user =
            await ensureFirebaseUser();

          uidRef.current =
            user.uid;

          const [server, local] =
            await Promise.all([
              loadServerWorkspace(),
              Promise.resolve(
                localWorkspace()
              ),
            ]);

          const localChecksum =
            await sha256(
              local.raw
            );

          const meta =
            readMeta(user.uid);

          setKnownRevision(
            server.revision
          );

          if (!server.workspace) {
            if (
              local.workspace &&
              local.raw
            ) {
              await saveLocalWorkspace({
                local,
                expectedRevision: 0,
                reason:
                  'Initial local-to-D1 migration',
              });
            } else {
              remember({
                server,
                localChecksum,
              });
              safeSetState('synced');
            }

            return;
          }

          const serverRaw =
            serializeWorkspace(
              server.workspace
            );

          const serverChecksum =
            server.checksum ??
            (await sha256(
              serverRaw
            ));

          const normalizedServer = {
            ...server,
            checksum:
              serverChecksum,
          };

          if (!local.workspace) {
            await applyServerWorkspace(
              normalizedServer
            );
            return;
          }

          if (
            localChecksum ===
            serverChecksum
          ) {
            remember({
              server:
                normalizedServer,
              localChecksum,
            });
            safeSetState('synced');
            return;
          }

          if (!meta) {
            await applyServerWorkspace(
              normalizedServer
            );
            return;
          }

          const localChanged =
            Boolean(
              localChecksum &&
              meta.localChecksum &&
              localChecksum !==
                meta.localChecksum
            );

          const serverChanged =
            Boolean(
              serverChecksum &&
              meta.serverChecksum &&
              serverChecksum !==
                meta.serverChecksum
            );

          if (
            localChanged &&
            !serverChanged
          ) {
            await saveLocalWorkspace({
              local,
              expectedRevision:
                server.revision,
              reason:
                'Offline/local changes reconciled to D1',
            });
            return;
          }

          if (
            localChanged &&
            serverChanged
          ) {
            conflictRef.current =
              normalizedServer;
            safeSetState('conflict');
            return;
          }

          await applyServerWorkspace(
            normalizedServer
          );
        } catch (error) {
          if (!navigator.onLine) {
            safeSetState('offline');
          } else if (
            error instanceof
              ReportOsServerError &&
            error.code ===
              'DATABASE_UNAVAILABLE'
          ) {
            safeSetState('unavailable');
          } else {
            safeSetState('unavailable');
          }
        }
      },
      [
        applyServerWorkspace,
        remember,
        safeSetState,
        saveLocalWorkspace,
        setKnownRevision,
      ]
    );

  const inspectLocalChanges =
    useCallback(
      async () => {
        if (
          busyRef.current ||
          state === 'connecting' ||
          state === 'conflict'
        ) {
          return;
        }

        const local =
          localWorkspace();

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
          safeSetState('offline');
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
              void saveLocalWorkspace({
                local,
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
        safeSetState,
        saveLocalWorkspace,
        state,
      ]
    );

  const inspectServerChanges =
    useCallback(
      async () => {
        if (
          busyRef.current ||
          state === 'connecting' ||
          state === 'conflict' ||
          !navigator.onLine
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
              state === 'offline' ||
              state === 'unavailable'
            ) {
              safeSetState('synced');
            }
            return;
          }

          const local =
            localWorkspace();

          const localChecksum =
            await sha256(
              local.raw
            );

          const localDirty =
            localChecksum !==
            syncedLocalChecksumRef.current;

          if (localDirty) {
            conflictRef.current =
              server;
            setKnownRevision(
              server.revision
            );
            safeSetState('conflict');
            return;
          }

          await applyServerWorkspace(
            server
          );
        } catch (error) {
          if (!navigator.onLine) {
            safeSetState('offline');
          } else if (
            error instanceof
              ReportOsServerError &&
            error.code ===
              'DATABASE_UNAVAILABLE'
          ) {
            safeSetState('unavailable');
          }
        }
      },
      [
        applyServerWorkspace,
        safeSetState,
        setKnownRevision,
        state,
      ]
    );

  const chooseServerVersion =
    useCallback(
      async () => {
        const server =
          conflictRef.current ??
          (await loadServerWorkspace());

        await applyServerWorkspace(
          server
        );
      },
      [applyServerWorkspace]
    );

  const chooseLocalVersion =
    useCallback(
      async () => {
        const local =
          localWorkspace();

        if (
          !local.workspace ||
          !local.raw
        ) {
          return;
        }

        const server =
          await loadServerWorkspace();

        await saveLocalWorkspace({
          local,
          expectedRevision:
            server.revision,
          reason:
            'Manual conflict resolution: keep local',
        });
      },
      [saveLocalWorkspace]
    );

  useEffect(() => {
    mountedRef.current = true;

    if (
      typeof BroadcastChannel !==
      'undefined'
    ) {
      const channel =
        new BroadcastChannel(
          'reportos-canonical-sync'
        );

      channel.onmessage = () => {
        void reconcile();
      };

      channelRef.current =
        channel;
    }

    void reconcile();

    const localTimer =
      window.setInterval(
        () => {
          void inspectLocalChanges();
        },
        LOCAL_POLL_MS
      );

    const serverTimer =
      window.setInterval(
        () => {
          void inspectServerChanges();
        },
        SERVER_POLL_MS
      );

    const onOnline = () => {
      void reconcile();
    };

    const onOffline = () => {
      safeSetState('offline');
    };

    window.addEventListener(
      'online',
      onOnline
    );
    window.addEventListener(
      'offline',
      onOffline
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

      channelRef.current?.close();
      channelRef.current = null;

      window.removeEventListener(
        'online',
        onOnline
      );
      window.removeEventListener(
        'offline',
        onOffline
      );
    };
  }, [
    inspectLocalChanges,
    inspectServerChanges,
    reconcile,
    safeSetState,
  ]);

  return (
    <aside
      className={`${styles.root} ${styles[state]}`}
      aria-live="polite"
      aria-label="ReportOS canonical sync status"
    >
      <span
        className={styles.dot}
        aria-hidden="true"
      />

      <div className={styles.copy}>
        <strong>
          {stateLabel(state)}
        </strong>
        <span>
          {stateDetail(
            state,
            revision
          )}
        </span>
      </div>

      {state === 'conflict' ? (
        <div
          className={styles.actions}
        >
          <button
            type="button"
            onClick={() => {
              void chooseServerVersion();
            }}
          >
            Use server
          </button>
          <button
            type="button"
            onClick={() => {
              void chooseLocalVersion();
            }}
          >
            Keep local
          </button>
        </div>
      ) : null}
    </aside>
  );
}
