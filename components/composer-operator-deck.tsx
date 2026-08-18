'use client';

import {
  AlertTriangle,
  Check,
  ChevronRight,
  Command,
  Copy,
  FilePlus2,
  FolderOpen,
  Gauge,
  Layers3,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import styles from './composer-operator-deck.module.css';

import {
  buildComposerFlow,
} from '@/lib/composer-flow';

import {
  buildComposerReadiness,
  cleanComposerTemplateReport,
  cloneComposerReport,
  defaultComposerTemplateName,
  type ComposerSectionId,
} from '@/lib/composer-operator';

import {
  ComposerTemplateClientError,
  deleteComposerTemplate,
  loadComposerTemplateById,
  loadComposerTemplateLibrary,
  saveComposerTemplate,
  type ComposerTemplateSummary,
} from '@/lib/composer-template-client';

import {
  EMPTY_REPORT,
  formatReport,
  type IncidentReport,
} from '@/lib/report';

import {
  createIncidentRecord,
  deserializeWorkspace,
  serializeWorkspace,
  type IncidentRecord,
  type WorkspaceSnapshot,
} from '@/lib/workspace';

const WORKSPACE_STORAGE_KEY =
  'reportos:workspace:v1';
const LEGACY_DRAFT_KEY =
  'reportos:draft:v1';

type DeckTab =
  | 'readiness'
  | 'templates'
  | 'actions';

type CurrentSnapshot = {
  workspace: WorkspaceSnapshot;
  incident: IncidentRecord;
};

type PaletteCommand = {
  id: string;
  label: string;
  detail: string;
  keywords: string;
  run: () => void;
};

function createId(): string {
  if (
    typeof crypto !== 'undefined' &&
    'randomUUID' in crypto
  ) {
    return crypto.randomUUID();
  }

  return (
    'incident-' +
    Date.now() +
    '-' +
    Math.random()
      .toString(36)
      .slice(2, 9)
  );
}

function readCurrentSnapshot():
  CurrentSnapshot | null {
  const workspace =
    deserializeWorkspace(
      window.localStorage.getItem(
        WORKSPACE_STORAGE_KEY
      )
    );

  if (
    !workspace ||
    workspace.incidents.length === 0
  ) {
    return null;
  }

  const incident =
    workspace.incidents.find(
      (candidate) =>
        candidate.id ===
        workspace.activeIncidentId
    ) ?? workspace.incidents[0];

  return {
    workspace,
    incident,
  };
}

function sectionLabel(
  section: ComposerSectionId
): string {
  switch (section) {
    case 'identity':
      return 'Incident identity';
    case 'dispatch':
      return 'Dispatch context';
    case 'progress':
      return 'Update progress';
    case 'closure':
      return 'Closure readiness';
    case 'preview':
      return 'Report preview';
    default:
      return 'Smart ingest';
  }
}

function findComposerSection(
  section: ComposerSectionId
): HTMLElement | null {
  const root =
    document.querySelector<HTMLElement>(
      '.app-shell[data-workspace-mode="compose"]'
    );

  if (!root) {
    return null;
  }

  if (section === 'ingest') {
    return root.querySelector<HTMLElement>(
      '.smart-import-card'
    );
  }

  if (section === 'preview') {
    return root.querySelector<HTMLElement>(
      '.preview-card, .report-preview-card, .preview-column'
    );
  }

  const wanted =
    sectionLabel(section)
      .toLocaleLowerCase('en-US');

  const heading =
    Array.from(
      root.querySelectorAll<HTMLElement>(
        'h2, h3, strong'
      )
    ).find(
      (candidate) =>
        candidate.textContent
          ?.trim()
          .toLocaleLowerCase('en-US') ===
        wanted
    );

  return (
    heading?.closest<HTMLElement>(
      '.section-card, .glass-panel, section, article'
    ) ??
    heading ??
    null
  );
}

function navigateWorkspace(
  workspace: 'composer' | 'operations' | 'archive'
) {
  window.location.assign(
    `/?workspace=${workspace}`
  );
}

export function ComposerOperatorDeck() {
  const [visible, setVisible] =
    useState(false);
  const [open, setOpen] =
    useState(false);
  const [tab, setTab] =
    useState<DeckTab>('readiness');
  const [snapshot, setSnapshot] =
    useState<CurrentSnapshot | null>(null);
  const [templates, setTemplates] =
    useState<ComposerTemplateSummary[]>([]);
  const [libraryRevision, setLibraryRevision] =
    useState(0);
  const [cloudBusy, setCloudBusy] =
    useState(false);
  const [cloudMessage, setCloudMessage] =
    useState('Cloud template library ready.');
  const [templateName, setTemplateName] =
    useState('');
  const [paletteOpen, setPaletteOpen] =
    useState(false);
  const [paletteQuery, setPaletteQuery] =
    useState('');

  const paletteInputRef =
    useRef<HTMLInputElement>(null);

  const closePalette =
    useCallback(() => {
      setPaletteOpen(false);
      setPaletteQuery('');
    }, []);

  const refreshSnapshot =
    useCallback(() => {
      const next =
        readCurrentSnapshot();

      setSnapshot(next);

      if (next) {
        setTemplateName(
          (current) =>
            current ||
            defaultComposerTemplateName(
              next.incident.report
            )
        );
      }
    }, []);

  useEffect(() => {
    const syncVisibility = () => {
      const nextVisible = Boolean(
        document.querySelector(
          '.app-shell[data-workspace-mode="compose"]'
        )
      );

      setVisible(nextVisible);

      if (!nextVisible) {
        setOpen(false);
        setPaletteOpen(false);
      }
    };

    const firstSync =
      window.setTimeout(
        syncVisibility,
        0
      );

    const observer =
      new MutationObserver(
        syncVisibility
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
      window.clearTimeout(
        firstSync
      );
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const firstSnapshot =
      window.setTimeout(
        refreshSnapshot,
        0
      );

    const interval =
      window.setInterval(
        refreshSnapshot,
        900
      );

    return () => {
      window.clearTimeout(
        firstSnapshot
      );
      window.clearInterval(
        interval
      );
    };
  }, [
    refreshSnapshot,
    visible,
  ]);

  const refreshLibrary =
    useCallback(async () => {
      if (!visible) {
        return;
      }

      setCloudBusy(true);

      try {
        const library =
          await loadComposerTemplateLibrary();

        setTemplates(
          library.templates
        );
        setLibraryRevision(
          library.libraryRevision
        );
        setCloudMessage(
          `${library.templates.length} reusable template${library.templates.length === 1 ? '' : 's'} synced from D1.`
        );
      } catch (error) {
        setCloudMessage(
          error instanceof Error
            ? error.message
            : 'Cloud template library is unavailable.'
        );
      } finally {
        setCloudBusy(false);
      }
    }, [visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const timer =
      window.setTimeout(
        () => {
          void refreshLibrary();
        },
        0
      );

    return () =>
      window.clearTimeout(timer);
  }, [
    refreshLibrary,
    visible,
  ]);

  const readiness =
    useMemo(
      () =>
        snapshot
          ? buildComposerReadiness(
              snapshot.incident.report,
              snapshot.incident.closureChecklist
            )
          : null,
      [snapshot]
    );

  const guidedFlow =
    useMemo(
      () =>
        snapshot
          ? buildComposerFlow(
              snapshot.incident.report,
              snapshot.incident.closureChecklist
            )
          : null,
      [snapshot]
    );

  const completedFlowStages =
    guidedFlow?.completedStageCount ?? 0;

  // REPORTOS_COMPOSER_UNIFIED_FLOW_V3: guided flow is part of the single Operator Control.

  const jumpTo =
    useCallback(
      (
        section: ComposerSectionId
      ) => {
        const target =
          findComposerSection(
            section
          );

        if (!target) {
          return;
        }

        target.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });

        const control =
          target.querySelector<HTMLElement>(
            'textarea, input, button'
          );

        window.setTimeout(
          () => control?.focus(),
          260
        );

        closePalette();
      },
      [closePalette]
    );

  const copyReport =
    useCallback(async () => {
      if (!snapshot) {
        return;
      }

      try {
        await navigator.clipboard.writeText(
          formatReport(
            snapshot.incident.report
          )
        );
        setCloudMessage(
          'Formatted incident report copied.'
        );
      } catch {
        setCloudMessage(
          'Clipboard access was blocked by the browser.'
        );
      }
    }, [snapshot]);

  const openAsNewDraft =
    useCallback(
      (
        report: IncidentReport
      ) => {
        const current =
          readCurrentSnapshot();
        const incident =
          createIncidentRecord(
            createId(),
            report
          );

        const nextWorkspace:
          WorkspaceSnapshot = {
          version: 1,
          activeIncidentId:
            incident.id,
          incidents: [
            incident,
            ...(current?.workspace.incidents ?? []),
          ],
        };

        window.localStorage.setItem(
          WORKSPACE_STORAGE_KEY,
          serializeWorkspace(
            nextWorkspace
          )
        );

        window.localStorage.setItem(
          LEGACY_DRAFT_KEY,
          JSON.stringify(report)
        );

        window.location.assign(
          '/?workspace=composer'
        );
      },
      []
    );

  const createBlankDraft =
    useCallback(() => {
      openAsNewDraft(
        cloneComposerReport(
          EMPTY_REPORT
        )
      );
    }, [openAsNewDraft]);

  const cloneCurrentDraft =
    useCallback(() => {
      if (!snapshot) {
        return;
      }

      openAsNewDraft(
        cloneComposerReport(
          snapshot.incident.report
        )
      );
    }, [
      openAsNewDraft,
      snapshot,
    ]);

  const saveCurrentTemplate =
    useCallback(async () => {
      if (
        !snapshot ||
        !templateName.trim()
      ) {
        setCloudMessage(
          'Give the reusable template a name first.'
        );
        return;
      }

      setCloudBusy(true);

      try {
        const saved =
          await saveComposerTemplate({
            name:
              templateName.trim(),
            report:
              cloneComposerReport(
                snapshot.incident.report
              ),
            expectedLibraryRevision:
              libraryRevision,
          });

        setTemplates(
          saved.templates
        );
        setLibraryRevision(
          saved.libraryRevision
        );
        setCloudMessage(
          `Saved “${saved.templateMeta.name}” to Cloudflare D1.`
        );
      } catch (error) {
        if (
          error instanceof
            ComposerTemplateClientError &&
          error.code ===
            'REVISION_CONFLICT'
        ) {
          setCloudMessage(
            'Template library changed in another session. Refresh and save again.'
          );
          await refreshLibrary();
        } else {
          setCloudMessage(
            error instanceof Error
              ? error.message
              : 'Template could not be saved.'
          );
        }
      } finally {
        setCloudBusy(false);
      }
    }, [
      libraryRevision,
      refreshLibrary,
      snapshot,
      templateName,
    ]);

  const openSavedTemplate =
    useCallback(
      async (
        templateId: string,
        clean: boolean
      ) => {
        setCloudBusy(true);

        try {
          const detail =
            await loadComposerTemplateById(
              templateId
            );

          setTemplates(
            detail.templates
          );
          setLibraryRevision(
            detail.libraryRevision
          );

          openAsNewDraft(
            clean
              ? cleanComposerTemplateReport(
                  detail.template
                )
              : cloneComposerReport(
                  detail.template
                )
          );
        } catch (error) {
          setCloudMessage(
            error instanceof Error
              ? error.message
              : 'Saved template could not be opened.'
          );
          setCloudBusy(false);
        }
      },
      [openAsNewDraft]
    );

  const removeSavedTemplate =
    useCallback(
      async (
        templateId: string
      ) => {
        setCloudBusy(true);

        try {
          const next =
            await deleteComposerTemplate({
              templateId,
              expectedLibraryRevision:
                libraryRevision,
            });

          setTemplates(
            next.templates
          );
          setLibraryRevision(
            next.libraryRevision
          );
          setCloudMessage(
            'Template removed from Cloudflare D1.'
          );
        } catch (error) {
          setCloudMessage(
            error instanceof Error
              ? error.message
              : 'Template could not be deleted.'
          );
        } finally {
          setCloudBusy(false);
        }
      },
      [libraryRevision]
    );

  const commands =
    useMemo<PaletteCommand[]>(
      () => [
        {
          id: 'ingest',
          label: 'Jump to Smart Ingest',
          detail: 'Paste or parse an incoming incident report.',
          keywords: 'paste parser smart import',
          run: () => jumpTo('ingest'),
        },
        {
          id: 'identity',
          label: 'Jump to Incident Identity',
          detail: 'Region, ticket, and headline.',
          keywords: 'region ticket summary identity',
          run: () => jumpTo('identity'),
        },
        {
          id: 'dispatch',
          label: 'Jump to Dispatch Context',
          detail: 'Timing, PIC, topology, root cause, and cut point.',
          keywords: 'dispatch pic rootcause cutpoint topology',
          run: () => jumpTo('dispatch'),
        },
        {
          id: 'progress',
          label: 'Jump to Update Progress',
          detail: 'Add the next chronological update.',
          keywords: 'progress update timeline',
          run: () => jumpTo('progress'),
        },
        {
          id: 'closure',
          label: 'Jump to Closure Readiness',
          detail: 'Finish administrative closure tasks.',
          keywords: 'closure wag matoa rfo email',
          run: () => jumpTo('closure'),
        },
        {
          id: 'copy',
          label: 'Copy formatted report',
          detail: 'Copy the WAG-ready output.',
          keywords: 'copy report wag clipboard output',
          run: () => {
            void copyReport();
          },
        },
        {
          id: 'blank',
          label: 'Create blank draft',
          detail: 'Preserve the current TT and open a clean incident.',
          keywords: 'new blank draft incident',
          run: createBlankDraft,
        },
        {
          id: 'clone',
          label: 'Clone current incident',
          detail: 'Create a separate exact copy.',
          keywords: 'clone duplicate incident',
          run: cloneCurrentDraft,
        },
        {
          id: 'templates',
          label: 'Open template library',
          detail: 'Save or reuse D1-backed Composer templates.',
          keywords: 'template library cloud d1',
          run: () => {
            setOpen(true);
            setTab('templates');
            closePalette();
          },
        },
        {
          id: 'operations',
          label: 'Open Operations',
          detail: 'Switch to the live command center.',
          keywords: 'operations command center',
          run: () =>
            navigateWorkspace(
              'operations'
            ),
        },
        {
          id: 'archive',
          label: 'Open Incident Vault',
          detail: 'Search or reopen incident memory.',
          keywords: 'archive vault history',
          run: () =>
            navigateWorkspace(
              'archive'
            ),
        },
      ],
      [
        cloneCurrentDraft,
        closePalette,
        copyReport,
        createBlankDraft,
        jumpTo,
      ]
    );

  const filteredCommands =
    useMemo(() => {
      const query =
        paletteQuery
          .trim()
          .toLocaleLowerCase(
            'en-US'
          );

      if (!query) {
        return commands;
      }

      return commands.filter(
        (command) =>
          `${command.label} ${command.detail} ${command.keywords}`
            .toLocaleLowerCase(
              'en-US'
            )
            .includes(query)
      );
    }, [
      commands,
      paletteQuery,
    ]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (
        (event.ctrlKey ||
          event.metaKey) &&
        event.key
          .toLocaleLowerCase(
            'en-US'
          ) === 'k'
      ) {
        event.preventDefault();
        setPaletteOpen(
          (current) => !current
        );
      }

      if (event.key === 'Escape') {
        closePalette();
      }
    };

    document.addEventListener(
      'keydown',
      handleKeyDown
    );

    return () =>
      document.removeEventListener(
        'keydown',
        handleKeyDown
      );
  }, [
    closePalette,
    visible,
  ]);

  useEffect(() => {
    if (!paletteOpen) {
      return;
    }

    const frame =
      window.requestAnimationFrame(
        () =>
          paletteInputRef.current?.focus()
      );

    return () =>
      window.cancelAnimationFrame(
        frame
      );
  }, [paletteOpen]);

  if (!visible) {
    return null;
  }

  const issues = [
    ...(readiness?.blockers ?? []),
    ...(readiness?.advisories ?? []),
  ];

  return (
    <>
      <button
        className={styles.launcher}
        data-ready={
          readiness?.readyForHandover
            ? 'true'
            : 'false'
        }
        type="button"
        aria-expanded={open}
        onClick={() =>
          setOpen(
            (current) => !current
          )
        }
      >
        <span className={styles.launcherIcon}>
          <Command size={15} />
        </span>
        <span className={styles.launcherCopy}>
          <strong>Operator Control</strong>
          <small>
            {issues.length === 0
              ? 'Ready · Ctrl K'
              : `${issues.length} signal${issues.length === 1 ? '' : 's'} · Ctrl K`}
          </small>
        </span>
        <ChevronRight
          className={
            open
              ? styles.launcherChevronOpen
              : styles.launcherChevron
          }
          size={14}
        />
      </button>

      {open ? (
        <aside
          className={styles.panel}
          aria-label="Composer operator deck"
        >
          <header className={styles.panelHeader}>
            <span className={styles.panelTitle}>
              <Command size={16} />
              <span>
                <strong>Operator Control</strong>
                <small>
                  Guided flow, readiness, templates, and actions.
                </small>
              </span>
            </span>
            <button
              className={styles.iconButton}
              type="button"
              aria-label="Close operator deck"
              onClick={() =>
                setOpen(false)
              }
            >
              <X size={15} />
            </button>
          </header>

          <div
            className={styles.tabs}
            role="tablist"
            aria-label="Composer operator tools"
          >
            {(
              [
                ['readiness', 'Readiness'],
                ['templates', 'Templates'],
                ['actions', 'Actions'],
              ] as const
            ).map(
              ([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={
                    tab === value
                  }
                  data-active={
                    tab === value
                  }
                  onClick={() =>
                    setTab(value)
                  }
                >
                  {label}
                  {value === 'templates' ? (
                    <span>
                      {templates.length}
                    </span>
                  ) : null}
                </button>
              )
            )}
          </div>

          {tab === 'readiness' ? (
            <div className={styles.panelBody}>
              {guidedFlow ? (
                <section
                  className={styles.guidedFlow}
                  aria-label="Composer guided flow"
                >
                  <div className={styles.guidedFlowStages}>
                    {guidedFlow.stages.map(
                      (stage, index) => (
                        <button
                          key={stage.id}
                          type="button"
                          data-state={stage.state}
                          onClick={() =>
                            jumpTo(stage.id)
                          }
                        >
                          <span className={styles.guidedFlowIndex}>
                            {stage.state === 'complete' ? (
                              <Check size={12} />
                            ) : (
                              index + 1
                            )}
                          </span>
                          <span className={styles.guidedFlowCopy}>
                            <strong>{stage.label}</strong>
                            <small>{stage.detail}</small>
                          </span>
                        </button>
                      )
                    )}
                  </div>

                  <button
                    className={styles.guidedFlowNext}
                    data-tone={guidedFlow.nextAction.tone}
                    type="button"
                    onClick={() =>
                      jumpTo(guidedFlow.nextAction.section)
                    }
                  >
                    <span>
                      <small>NEXT REQUIRED</small>
                      <strong>
                        {guidedFlow.nextAction.label}
                      </strong>
                    </span>
                    <span className={styles.guidedFlowMeta}>
                      {completedFlowStages}/4
                    </span>
                    <ChevronRight size={14} />
                  </button>
                </section>
              ) : null}

              <div className={styles.scoreGrid}>
                <article>
                  <Gauge size={16} />
                  <span>
                    <small>REPORT</small>
                    <strong>
                      {readiness?.reportScore ?? 0}%
                    </strong>
                  </span>
                </article>
                <article>
                  <ShieldCheck size={16} />
                  <span>
                    <small>CLOSURE</small>
                    <strong>
                      {readiness?.closureScore ?? 0}%
                    </strong>
                  </span>
                </article>
                <article>
                  {readiness?.readyForHandover ? (
                    <Check size={16} />
                  ) : (
                    <AlertTriangle size={16} />
                  )}
                  <span>
                    <small>HANDOVER</small>
                    <strong>
                      {readiness?.readyForHandover
                        ? 'READY'
                        : 'HOLD'}
                    </strong>
                  </span>
                </article>
              </div>

              <div className={styles.readinessList}>
                {issues.length === 0 ? (
                  <div className={styles.readyState}>
                    <Check size={18} />
                    <span>
                      <strong>No readiness gaps detected</strong>
                      <small>
                        Core report fields are ready for final review.
                      </small>
                    </span>
                  </div>
                ) : (
                  issues.map(
                    (issue) => (
                      <button
                        className={styles.readinessItem}
                        data-severity={issue.severity}
                        type="button"
                        key={issue.id}
                        onClick={() =>
                          jumpTo(
                            issue.section
                          )
                        }
                      >
                        <span className={styles.readinessDot} />
                        <span>
                          <strong>{issue.label}</strong>
                          <small>{issue.detail}</small>
                        </span>
                        <ChevronRight size={14} />
                      </button>
                    )
                  )
                )}
              </div>
            </div>
          ) : null}

          {tab === 'templates' ? (
            <div className={styles.panelBody}>
              <div className={styles.cloudStatus}>
                <FolderOpen size={15} />
                <span>
                  <strong>Reusable incident templates</strong>
                  <small>{cloudMessage}</small>
                </span>
                <button
                  className={styles.iconButton}
                  type="button"
                  disabled={cloudBusy}
                  title="Refresh template library"
                  onClick={() => {
                    void refreshLibrary();
                  }}
                >
                  <RefreshCcw size={14} />
                </button>
              </div>

              <div className={styles.templateSaveRow}>
                <input
                  value={templateName}
                  placeholder="Template name"
                  maxLength={180}
                  onChange={(event) =>
                    setTemplateName(
                      event.target.value
                    )
                  }
                />
                <button
                  type="button"
                  disabled={
                    cloudBusy ||
                    !snapshot ||
                    !templateName.trim()
                  }
                  onClick={() => {
                    void saveCurrentTemplate();
                  }}
                >
                  <Save size={14} />
                  Save current
                </button>
              </div>

              <div className={styles.templateList}>
                {templates.length === 0 ? (
                  <div className={styles.emptyTemplateState}>
                    <Layers3 size={18} />
                    <strong>No reusable templates yet</strong>
                    <small>
                      Save the current incident once, then reopen it as a clean draft or exact clone.
                    </small>
                  </div>
                ) : (
                  templates.map(
                    (template) => (
                      <article
                        className={styles.templateItem}
                        key={template.id}
                      >
                        <span className={styles.templateIcon}>
                          <FolderOpen size={15} />
                        </span>
                        <span className={styles.templateCopy}>
                          <strong>{template.name}</strong>
                          <small>
                            {template.region || 'No region'}
                            {' · '}
                            {template.progressCount} update{template.progressCount === 1 ? '' : 's'}
                          </small>
                        </span>
                        <div className={styles.templateActions}>
                          <button
                            type="button"
                            disabled={cloudBusy}
                            title="Open as clean draft"
                            onClick={() => {
                              void openSavedTemplate(
                                template.id,
                                true
                              );
                            }}
                          >
                            Clean
                          </button>
                          <button
                            type="button"
                            disabled={cloudBusy}
                            title="Clone exact saved state"
                            onClick={() => {
                              void openSavedTemplate(
                                template.id,
                                false
                              );
                            }}
                          >
                            Exact
                          </button>
                          <button
                            className={styles.deleteTemplate}
                            type="button"
                            disabled={cloudBusy}
                            aria-label={`Delete ${template.name}`}
                            title="Delete template"
                            onClick={() => {
                              void removeSavedTemplate(
                                template.id
                              );
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </article>
                    )
                  )
                )}
              </div>
            </div>
          ) : null}

          {tab === 'actions' ? (
            <div className={styles.panelBody}>
              <div className={styles.actionGrid}>
                <button
                  type="button"
                  onClick={() =>
                    setPaletteOpen(true)
                  }
                >
                  <Command size={16} />
                  <span>
                    <strong>Command palette</strong>
                    <small>Ctrl / Cmd + K</small>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void copyReport();
                  }}
                >
                  <Copy size={16} />
                  <span>
                    <strong>Copy report</strong>
                    <small>WAG-ready output</small>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={createBlankDraft}
                >
                  <FilePlus2 size={16} />
                  <span>
                    <strong>Blank draft</strong>
                    <small>Preserve current TT</small>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={cloneCurrentDraft}
                >
                  <Layers3 size={16} />
                  <span>
                    <strong>Clone incident</strong>
                    <small>Exact independent copy</small>
                  </span>
                </button>
              </div>

              <div className={styles.jumpGrid}>
                {(
                  [
                    'ingest',
                    'identity',
                    'dispatch',
                    'progress',
                    'closure',
                    'preview',
                  ] as ComposerSectionId[]
                ).map(
                  (section) => (
                    <button
                      type="button"
                      key={section}
                      onClick={() =>
                        jumpTo(section)
                      }
                    >
                      {sectionLabel(section)}
                    </button>
                  )
                )}
              </div>
            </div>
          ) : null}
        </aside>
      ) : null}

      {paletteOpen ? (
        <div
          className={styles.paletteBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closePalette();
            }
          }}
        >
          <section
            className={styles.palette}
            role="dialog"
            aria-modal="true"
            aria-label="Composer command palette"
          >
            <header className={styles.paletteSearch}>
              <Search size={17} />
              <input
                ref={paletteInputRef}
                value={paletteQuery}
                placeholder="Search Composer commands…"
                onChange={(event) =>
                  setPaletteQuery(
                    event.target.value
                  )
                }
              />
              <kbd>ESC</kbd>
            </header>

            <div className={styles.paletteList}>
              {filteredCommands.length === 0 ? (
                <div className={styles.paletteEmpty}>
                  No matching command.
                </div>
              ) : (
                filteredCommands.map(
                  (command) => (
                    <button
                      type="button"
                      key={command.id}
                      onClick={() => {
                        command.run();
                        closePalette();
                      }}
                    >
                      <Command size={14} />
                      <span>
                        <strong>{command.label}</strong>
                        <small>{command.detail}</small>
                      </span>
                      <ChevronRight size={14} />
                    </button>
                  )
                )
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
