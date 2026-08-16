'use client';

import {
  AlertTriangle,
  Check,
  Cloud,
  RefreshCcw,
  Save,
} from 'lucide-react';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  BackboneImpactBoard,
} from '@/components/backbone-impact-board';

import {
  ReportOsRouteSidebar,
} from '@/components/reportos-route-sidebar';

import type {
  BackboneImpactDraft,
} from '@/lib/backbone-impact';

import {
  ImpactTemplateClientError,
  loadImpactTemplate,
  saveImpactTemplate,
} from '@/lib/impact-template-client';

const STORAGE_KEY =
  'reportos:backbone-impact:v1';

const CLOUD_POLL_MS = 1400;

type CloudState =
  | 'connecting'
  | 'synced'
  | 'saving'
  | 'error'
  | 'conflict';

function readLocalDraft():
  BackboneImpactDraft | null {
  try {
    const raw =
      window.localStorage.getItem(
        STORAGE_KEY
      );

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(
      raw
    ) as BackboneImpactDraft;

    if (
      !parsed ||
      typeof parsed.title !== 'string' ||
      !Array.isArray(
        parsed.customers
      )
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function draftFingerprint(
  draft: BackboneImpactDraft
): string {
  return JSON.stringify(draft);
}

function cloudLabel(
  state: CloudState
): string {
  switch (state) {
    case 'connecting':
      return 'Connecting cloud';
    case 'saving':
      return 'Saving to D1';
    case 'error':
      return 'Cloud retry needed';
    case 'conflict':
      return 'Cloud changed';
    default:
      return 'Cloud synced';
  }
}

export function BackboneImpactWorkspace() {
  const [bootstrapped, setBootstrapped] =
    useState(false);

  const [cloudState, setCloudState] =
    useState<CloudState>('connecting');

  const [cloudUpdatedAt, setCloudUpdatedAt] =
    useState<number | null>(null);

  const revisionRef =
    useRef(0);

  const lastCloudFingerprintRef =
    useRef<string | null>(null);

  const saveInFlightRef =
    useRef(false);

  const blockedByConflictRef =
    useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const remote =
          await loadImpactTemplate();

        if (cancelled) {
          return;
        }

        revisionRef.current =
          remote.revision;

        setCloudUpdatedAt(
          remote.updatedAt
        );

        if (remote.template) {
          window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(
              remote.template
            )
          );

          lastCloudFingerprintRef.current =
            draftFingerprint(
              remote.template
            );
        }

        setCloudState('synced');
      } catch {
        if (!cancelled) {
          setCloudState('error');
        }
      } finally {
        if (!cancelled) {
          setBootstrapped(true);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const saveCurrentTemplate =
    useCallback(
      async (
        force = false
      ) => {
        if (
          saveInFlightRef.current ||
          blockedByConflictRef.current
        ) {
          return;
        }

        const local =
          readLocalDraft();

        if (!local) {
          return;
        }

        const fingerprint =
          draftFingerprint(local);

        if (
          !force &&
          fingerprint ===
            lastCloudFingerprintRef.current
        ) {
          setCloudState('synced');
          return;
        }

        saveInFlightRef.current = true;
        setCloudState('saving');

        try {
          const saved =
            await saveImpactTemplate({
              draft: local,
              expectedRevision:
                revisionRef.current,
            });

          revisionRef.current =
            saved.revision;

          lastCloudFingerprintRef.current =
            fingerprint;

          setCloudUpdatedAt(
            saved.updatedAt
          );

          setCloudState('synced');
        } catch (error) {
          if (
            error instanceof
              ImpactTemplateClientError &&
            error.code ===
              'REVISION_CONFLICT'
          ) {
            blockedByConflictRef.current =
              true;
            setCloudState('conflict');
          } else {
            setCloudState('error');
          }
        } finally {
          saveInFlightRef.current = false;
        }
      },
      []
    );

  useEffect(() => {
    if (!bootstrapped) {
      return;
    }

    const interval =
      window.setInterval(
        () => {
          void saveCurrentTemplate(
            false
          );
        },
        CLOUD_POLL_MS
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [
    bootstrapped,
    saveCurrentTemplate,
  ]);

  async function reloadCloudTemplate() {
    setCloudState('connecting');

    try {
      const remote =
        await loadImpactTemplate();

      revisionRef.current =
        remote.revision;

      setCloudUpdatedAt(
        remote.updatedAt
      );

      if (remote.template) {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(
            remote.template
          )
        );

        lastCloudFingerprintRef.current =
          draftFingerprint(
            remote.template
          );
      }

      blockedByConflictRef.current =
        false;

      setCloudState('synced');

      window.location.reload();
    } catch {
      setCloudState('error');
    }
  }

  const statusIcon =
    cloudState === 'synced'
      ? <Check size={14} />
      : cloudState === 'conflict'
        ? <AlertTriangle size={14} />
        : <Cloud size={14} />;

  const updatedLabel =
    cloudUpdatedAt
      ? new Intl.DateTimeFormat(
          'en-GB',
          {
            hour: '2-digit',
            minute: '2-digit',
          }
        ).format(
          new Date(
            cloudUpdatedAt
          )
        )
      : null;

  return (
    <div
      className="impact-route-shell app-shell"
      data-workspace-mode="impact"
    >
      <ReportOsRouteSidebar
        active="impact"
      />

      <section className="impact-route-main">
        <div
          className="impact-cloud-toolbar"
          data-state={cloudState}
          aria-live="polite"
        >
          <span className="impact-cloud-state">
            {statusIcon}
            <span>
              <strong>
                {cloudLabel(
                  cloudState
                )}
              </strong>
              <small>
                D1 canonical template
                {updatedLabel
                  ? ` · ${updatedLabel}`
                  : ''}
              </small>
            </span>
          </span>

          {cloudState ===
          'conflict' ? (
            <button
              type="button"
              onClick={() =>
                void reloadCloudTemplate()
              }
            >
              <RefreshCcw
                size={14}
              />
              Reload cloud
            </button>
          ) : (
            <button
              type="button"
              disabled={
                cloudState ===
                'saving' ||
                cloudState ===
                'connecting'
              }
              onClick={() =>
                void saveCurrentTemplate(
                  true
                )
              }
            >
              <Save size={14} />
              Save template
            </button>
          )}
        </div>

        {bootstrapped ? (
          <BackboneImpactBoard />
        ) : (
          <div className="impact-cloud-boot">
            <Cloud size={20} />
            <strong>
              Loading Impact Board
            </strong>
            <span>
              Resolving your cloud template before opening the editor.
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
