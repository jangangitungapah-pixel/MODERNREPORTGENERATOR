'use client';

import {
  AlertTriangle,
  Check,
  Cloud,
  FolderOpen,
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
  loadImpactTemplateById,
  loadImpactTemplateLibrary,
  saveImpactTemplate,
  type ImpactTemplateSummary,
} from '@/lib/impact-template-client';

const STORAGE_KEY =
  'reportos:backbone-impact:v1';

type CloudState =
  | 'connecting'
  | 'synced'
  | 'saving'
  | 'loading'
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

function cleanTemplateName(
  value: string
): string {
  return value
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizedTemplateName(
  value: string
): string {
  return cleanTemplateName(value)
    .toLocaleLowerCase('en-US');
}

function cloudLabel(
  state: CloudState
): string {
  switch (state) {
    case 'connecting':
      return 'Connecting library';
    case 'saving':
      return 'Saving template';
    case 'loading':
      return 'Loading template';
    case 'error':
      return 'Cloud action needed';
    case 'conflict':
      return 'Library changed';
    default:
      return 'Library synced';
  }
}

function formatUpdatedAt(
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
  ).format(
    new Date(value)
  );
}

export function BackboneImpactWorkspace() {
  const [bootstrapped, setBootstrapped] =
    useState(false);

  const [cloudState, setCloudState] =
    useState<CloudState>('connecting');

  const [cloudUpdatedAt, setCloudUpdatedAt] =
    useState<number | null>(null);

  const [cloudMessage, setCloudMessage] =
    useState<string | null>(null);

  const [templates, setTemplates] =
    useState<ImpactTemplateSummary[]>([]);

  const [libraryOpen, setLibraryOpen] =
    useState(false);

  const [activeTemplateId, setActiveTemplateId] =
    useState<string | null>(null);

  const [boardKey, setBoardKey] =
    useState(0);

  const libraryRevisionRef =
    useRef(0);

  const saveInFlightRef =
    useRef(false);

  const blockedByConflictRef =
    useRef(false);

  const applyLibrary =
    useCallback(
      ({
        templates: nextTemplates,
        libraryRevision,
        updatedAt,
      }: {
        templates: ImpactTemplateSummary[];
        libraryRevision: number;
        updatedAt: number | null;
      }) => {
        libraryRevisionRef.current =
          libraryRevision;
        setTemplates(
          nextTemplates
        );
        setCloudUpdatedAt(
          updatedAt
        );
      },
      []
    );

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const remote =
          await loadImpactTemplateLibrary();

        if (cancelled) {
          return;
        }

        applyLibrary(remote);

        if (
          !readLocalDraft() &&
          remote.templates.length > 0
        ) {
          const latest =
            await loadImpactTemplateById(
              remote.templates[0].id
            );

          if (cancelled) {
            return;
          }

          window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(
              latest.template
            )
          );

          applyLibrary(latest);
          setActiveTemplateId(
            latest.templateMeta.id
          );
          setBoardKey(
            (current) =>
              current + 1
          );
        }

        setCloudState('synced');
      } catch (error) {
        if (!cancelled) {
          setCloudState('error');
          setCloudMessage(
            error instanceof Error
              ? error.message
              : 'Template library could not be loaded.'
          );
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
  }, [applyLibrary]);

  const refreshLibrary =
    useCallback(
      async () => {
        setCloudState('connecting');
        setCloudMessage(null);

        try {
          const remote =
            await loadImpactTemplateLibrary();

          applyLibrary(remote);
          blockedByConflictRef.current =
            false;
          setCloudState('synced');
        } catch (error) {
          setCloudState('error');
          setCloudMessage(
            error instanceof Error
              ? error.message
              : 'Template library could not be refreshed.'
          );
        }
      },
      [applyLibrary]
    );

  const saveCurrentTemplate =
    useCallback(
      async () => {
        if (
          saveInFlightRef.current ||
          blockedByConflictRef.current
        ) {
          return;
        }

        const local =
          readLocalDraft();

        if (!local) {
          setCloudState('error');
          setCloudMessage(
            'No local Impact Board draft is available to save.'
          );
          return;
        }

        const name =
          cleanTemplateName(
            local.title
          );

        if (!name) {
          setCloudState('error');
          setCloudMessage(
            'Give the Impact Board a title before saving the template.'
          );
          return;
        }

        const normalizedName =
          normalizedTemplateName(
            name
          );

        const activeTemplate =
          activeTemplateId
            ? templates.find(
                (template) =>
                  template.id ===
                  activeTemplateId
              )
            : undefined;

        const sameNameTemplate =
          templates.find(
            (template) =>
              normalizedTemplateName(
                template.name
              ) === normalizedName
          );

        const templateId =
          activeTemplate &&
          normalizedTemplateName(
            activeTemplate.name
          ) === normalizedName
            ? activeTemplate.id
            : sameNameTemplate?.id;

        saveInFlightRef.current = true;
        setCloudState('saving');
        setCloudMessage(null);

        try {
          const saved =
            await saveImpactTemplate({
              draft: {
                ...local,
                title: name,
              },
              expectedLibraryRevision:
                libraryRevisionRef.current,
              ...(templateId
                ? {
                    templateId,
                  }
                : {}),
            });

          applyLibrary(saved);
          setActiveTemplateId(
            saved.templateMeta.id
          );
          blockedByConflictRef.current =
            false;
          setCloudState('synced');
          setCloudMessage(
            `Saved “${saved.templateMeta.name}” to the template library.`
          );
          setLibraryOpen(true);
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
            setCloudMessage(
              'The cloud library changed in another session. Refresh the library before saving again.'
            );
          } else {
            setCloudState('error');
            setCloudMessage(
              error instanceof Error
                ? error.message
                : 'Template could not be saved.'
            );
          }
        } finally {
          saveInFlightRef.current = false;
        }
      },
      [
        activeTemplateId,
        applyLibrary,
        templates,
      ]
    );

  const openSavedTemplate =
    useCallback(
      async (
        templateId: string
      ) => {
        setCloudState('loading');
        setCloudMessage(null);

        try {
          const remote =
            await loadImpactTemplateById(
              templateId
            );

          window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(
              remote.template
            )
          );

          applyLibrary(remote);
          setActiveTemplateId(
            remote.templateMeta.id
          );
          setBoardKey(
            (current) =>
              current + 1
          );
          setLibraryOpen(false);
          blockedByConflictRef.current =
            false;
          setCloudState('synced');
          setCloudMessage(
            `Loaded “${remote.templateMeta.name}”.`
          );
        } catch (error) {
          setCloudState('error');
          setCloudMessage(
            error instanceof Error
              ? error.message
              : 'Saved template could not be loaded.'
          );
        }
      },
      [applyLibrary]
    );

  const statusIcon =
    cloudState === 'synced'
      ? <Check size={14} />
      : cloudState === 'error' ||
          cloudState === 'conflict'
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
                {cloudMessage ??
                  `Cloudflare D1 · ${templates.length} saved${updatedLabel
                    ? ` · ${updatedLabel}`
                    : ''}`}
              </small>
            </span>
          </span>

          <button
            className="impact-template-library-toggle"
            type="button"
            aria-expanded={libraryOpen}
            aria-controls="impact-template-library"
            onClick={() =>
              setLibraryOpen(
                (current) =>
                  !current
              )
            }
          >
            <FolderOpen size={14} />
            Templates
            <span className="impact-template-count">
              {templates.length}
            </span>
          </button>

          {cloudState ===
          'conflict' ? (
            <button
              type="button"
              onClick={() =>
                void refreshLibrary()
              }
            >
              <RefreshCcw
                size={14}
              />
              Refresh library
            </button>
          ) : (
            <button
              type="button"
              disabled={
                cloudState ===
                'saving' ||
                cloudState ===
                'loading' ||
                cloudState ===
                'connecting'
              }
              onClick={() =>
                void saveCurrentTemplate()
              }
            >
              <Save size={14} />
              Save template
            </button>
          )}
        </div>

        {libraryOpen ? (
          <aside
            className="impact-template-library"
            id="impact-template-library"
            aria-label="Saved Impact Board templates"
          >
            <header className="impact-template-library-head">
              <span>
                <strong>
                  Saved templates
                </strong>
                <small>
                  {templates.length === 0
                    ? 'No cloud templates yet'
                    : `${templates.length} reusable template${templates.length === 1
                      ? ''
                      : 's'} in Cloudflare D1`}
                </small>
              </span>

              <button
                type="button"
                aria-label="Refresh saved templates"
                title="Refresh saved templates"
                onClick={() =>
                  void refreshLibrary()
                }
              >
                <RefreshCcw
                  size={14}
                />
              </button>
            </header>

            {templates.length === 0 ? (
              <div className="impact-template-library-empty">
                <FolderOpen size={20} />
                <strong>
                  Save your first template
                </strong>
                <span>
                  The Impact Board title becomes the template name automatically.
                </span>
              </div>
            ) : (
              <div className="impact-template-library-list">
                {templates.map(
                  (template) => (
                    <button
                      className="impact-template-library-item"
                      data-active={
                        activeTemplateId ===
                        template.id
                      }
                      type="button"
                      key={template.id}
                      disabled={
                        cloudState ===
                        'loading'
                      }
                      onClick={() =>
                        void openSavedTemplate(
                          template.id
                        )
                      }
                    >
                      <span className="impact-template-library-icon">
                        <FolderOpen
                          size={15}
                        />
                      </span>

                      <span className="impact-template-library-copy">
                        <strong>
                          {template.name}
                        </strong>
                        <small>
                          {template.customerCount} customer{template.customerCount === 1
                            ? ''
                            : 's'}
                          {' · '}
                          {template.serviceCount} service{template.serviceCount === 1
                            ? ''
                            : 's'}
                          {' · '}
                          {formatUpdatedAt(
                            template.updatedAt
                          )}
                        </small>
                      </span>

                      <span className="impact-template-library-action">
                        {activeTemplateId ===
                        template.id
                          ? 'Active'
                          : 'Open'}
                      </span>
                    </button>
                  )
                )}
              </div>
            )}
          </aside>
        ) : null}

        {bootstrapped ? (
          <BackboneImpactBoard
            key={boardKey}
          />
        ) : (
          <div className="impact-cloud-boot">
            <Cloud size={20} />
            <strong>
              Loading Impact Board
            </strong>
            <span>
              Resolving your cloud template library before opening the editor.
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
