'use client';

import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Eye,
  Sparkles,
} from 'lucide-react';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import styles from './composer-flow-guide.module.css';

import {
  buildComposerFlow,
  type ComposerFlowStageId,
} from '@/lib/composer-flow';

import {
  type ComposerSectionId,
} from '@/lib/composer-operator';

import {
  deserializeWorkspace,
  type IncidentRecord,
} from '@/lib/workspace';

const WORKSPACE_STORAGE_KEY =
  'reportos:workspace:v1';

const ISSUE_FIELD_LABEL: Record<
  string,
  string
> = {
  region: 'Region',
  ticket: 'Trouble ticket',
  summary: 'Alarm / link summary',
  'occur-time': 'Occur time',
  'dispatch-time': 'Dispatch time',
  pic: 'PIC',
  rootcause: 'Rootcause',
  'cut-point': 'Cut point',
};

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
    ) ??
    workspace.incidents[0] ??
    null
  );
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

function composerRoot(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    '.app-shell[data-workspace-mode="compose"]'
  );
}

function findSection(
  section: ComposerSectionId
): HTMLElement | null {
  const root = composerRoot();

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

function findLabeledControl(
  root: HTMLElement,
  labelText: string
): HTMLElement | null {
  const normalized =
    labelText
      .trim()
      .toLocaleLowerCase('en-US');

  const label =
    Array.from(
      root.querySelectorAll<HTMLElement>(
        'label, .field, .field-label, .field-label-row'
      )
    ).find((candidate) => {
      const text =
        candidate.textContent
          ?.replace(/\s+/g, ' ')
          .trim()
          .toLocaleLowerCase('en-US');

      return Boolean(
        text === normalized ||
        text?.startsWith(
          normalized + ' '
        )
      );
    });

  if (!label) {
    return null;
  }

  return (
    label.matches(
      'input, textarea, button, select'
    )
      ? label
      : label.querySelector<HTMLElement>(
          'input, textarea, button, select'
        )
  );
}

function findIssueControl(
  issueId: string,
  section: ComposerSectionId,
  root: HTMLElement
): HTMLElement | null {
  const fieldLabel =
    ISSUE_FIELD_LABEL[issueId];

  if (fieldLabel) {
    const field =
      findLabeledControl(
        root,
        fieldLabel
      );

    if (field) {
      return field;
    }
  }

  if (issueId === 'progress-empty') {
    return (
      root.querySelector<HTMLElement>(
        'input[placeholder*="latest activity" i], textarea[placeholder*="latest activity" i]'
      ) ??
      root.querySelector<HTMLElement>(
        'textarea, input'
      )
    );
  }

  if (issueId === 'primary-marker') {
    return root.querySelector<HTMLElement>(
      '.marker-selector button, .marker-option'
    );
  }

  if (
    issueId === 'closure-incomplete' ||
    section === 'closure'
  ) {
    return root.querySelector<HTMLElement>(
      'input[type="checkbox"], button'
    );
  }

  return root.querySelector<HTMLElement>(
    'textarea, input, button, select'
  );
}

function focusTarget(
  target: HTMLElement,
  control?: HTMLElement | null
) {
  const previous =
    document.querySelector<HTMLElement>(
      '[data-reportos-flow-focus="true"]'
    );

  previous?.removeAttribute(
    'data-reportos-flow-focus'
  );

  target.setAttribute(
    'data-reportos-flow-focus',
    'true'
  );

  target.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  });

  window.setTimeout(() => {
    control?.focus({
      preventScroll: true,
    });
  }, 300);

  window.setTimeout(() => {
    target.removeAttribute(
      'data-reportos-flow-focus'
    );
  }, 1700);
}

export function ComposerFlowGuide() {
  const [visible, setVisible] =
    useState(false);
  const [incident, setIncident] =
    useState<IncidentRecord | null>(null);
  const [collapsed, setCollapsed] =
    useState(false);

  useEffect(() => {
    const syncVisibility = () => {
      const nextVisible =
        Boolean(composerRoot());

      setVisible(nextVisible);
    };

    const initial =
      window.setTimeout(
        syncVisibility,
        0
      );

    const observer =
      new MutationObserver(
        syncVisibility
      );

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'data-workspace-mode',
      ],
    });

    return () => {
      window.clearTimeout(initial);
      observer.disconnect();
    };
  }, []);

  const refreshIncident =
    useCallback(() => {
      setIncident(
        readCurrentIncident()
      );
    }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const initial =
      window.setTimeout(
        refreshIncident,
        0
      );

    const timer =
      window.setInterval(
        refreshIncident,
        650
      );

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [
    refreshIncident,
    visible,
  ]);

  const flow =
    useMemo(
      () =>
        incident
          ? buildComposerFlow(
              incident.report,
              incident.closureChecklist
            )
          : null,
      [incident]
    );

  const jumpToSection =
    useCallback(
      (
        section: ComposerSectionId,
        issueId?: string
      ) => {
        const target =
          findSection(section);

        if (!target) {
          return;
        }

        const control =
          issueId
            ? findIssueControl(
                issueId,
                section,
                target
              )
            : target.querySelector<HTMLElement>(
                'textarea, input, button, select'
              );

        focusTarget(
          target,
          control
        );
      },
      []
    );

  const jumpToStage =
    useCallback(
      (stage: ComposerFlowStageId) => {
        jumpToSection(stage);
      },
      [jumpToSection]
    );

  const continueFlow =
    useCallback(() => {
      if (!flow) {
        return;
      }

      jumpToSection(
        flow.nextAction.section,
        flow.nextAction.id
      );
    }, [
      flow,
      jumpToSection,
    ]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (
        event.altKey &&
        event.key
          .toLocaleLowerCase('en-US') ===
          'j'
      ) {
        event.preventDefault();
        continueFlow();
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
    continueFlow,
    visible,
  ]);

  if (
    !visible ||
    !flow
  ) {
    return null;
  }

  return (
    <aside
      className={styles.dock}
      data-collapsed={
        collapsed
          ? 'true'
          : 'false'
      }
      aria-label="Composer guided flow"
    >
      <div className={styles.progressTrack}>
        <button
          className={styles.ingestShortcut}
          type="button"
          title="Smart Ingest"
          onClick={() =>
            jumpToSection('ingest')
          }
        >
          <ClipboardPaste size={14} />
          <span>Ingest</span>
        </button>

        <div
          className={styles.stageList}
          aria-label="Composer progress"
        >
          {flow.stages.map(
            (stage, index) => (
              <button
                className={styles.stage}
                data-state={stage.state}
                key={stage.id}
                type="button"
                title={`${stage.label} · ${stage.detail}`}
                onClick={() =>
                  jumpToStage(stage.id)
                }
              >
                <span className={styles.stageIndex}>
                  {stage.state === 'complete' ? (
                    <Check size={11} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className={styles.stageCopy}>
                  <strong>{stage.label}</strong>
                  <small>{stage.detail}</small>
                </span>
              </button>
            )
          )}
        </div>

        <button
          className={styles.previewShortcut}
          type="button"
          title="Report preview"
          onClick={() =>
            jumpToSection('preview')
          }
        >
          <Eye size={14} />
          <span>Preview</span>
        </button>
      </div>

      {!collapsed ? (
        <div
          className={styles.nextAction}
          data-tone={
            flow.nextAction.tone
          }
        >
          <span className={styles.nextIcon}>
            <Sparkles size={14} />
          </span>

          <span className={styles.nextCopy}>
            <small>
              {flow.nextAction.tone === 'required'
                ? 'NEXT REQUIRED'
                : flow.nextAction.tone === 'advisory'
                  ? 'NEXT IMPROVEMENT'
                  : 'READY TO REVIEW'}
            </small>
            <strong>
              {flow.nextAction.label}
            </strong>
          </span>

          <span className={styles.flowMeta}>
            <strong>
              {flow.reportScore}%
            </strong>
            <small>
              {flow.blockerCount > 0
                ? `${flow.blockerCount} blocker${flow.blockerCount === 1 ? '' : 's'}`
                : flow.advisoryCount > 0
                  ? `${flow.advisoryCount} advisory`
                  : 'core clear'}
            </small>
          </span>

          <button
            className={styles.continueButton}
            type="button"
            onClick={continueFlow}
          >
            Continue
            <ArrowRight size={14} />
            <kbd>Alt J</kbd>
          </button>
        </div>
      ) : null}

      <button
        className={styles.collapseButton}
        type="button"
        aria-label={
          collapsed
            ? 'Expand Composer flow guide'
            : 'Collapse Composer flow guide'
        }
        title={
          collapsed
            ? 'Expand flow guide'
            : 'Collapse flow guide'
        }
        onClick={() =>
          setCollapsed(
            (current) => !current
          )
        }
      >
        {collapsed ? (
          <ChevronUp size={14} />
        ) : (
          <ChevronDown size={14} />
        )}
      </button>
    </aside>
  );
}
