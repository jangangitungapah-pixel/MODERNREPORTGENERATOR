import {
  closureChecklistComplete,
  closureChecklistScore,
  type ClosureChecklist,
} from './closure';

import {
  buildComposerReadiness,
  type ComposerReadinessIssue,
  type ComposerSectionId,
} from './composer-operator';

import type {
  IncidentReport,
} from './report';

export type ComposerFlowStageId =
  | 'identity'
  | 'dispatch'
  | 'progress'
  | 'closure';

export type ComposerFlowStageState =
  | 'complete'
  | 'current'
  | 'upcoming';

export type ComposerFlowStage = {
  id: ComposerFlowStageId;
  label: string;
  state: ComposerFlowStageState;
  detail: string;
};

export type ComposerFlowNextAction = {
  id: string;
  label: string;
  detail: string;
  section: ComposerSectionId;
  tone: 'required' | 'advisory' | 'ready';
};

export type ComposerFlow = {
  stages: ComposerFlowStage[];
  nextAction: ComposerFlowNextAction;
  reportScore: number;
  closureScore: number;
  blockerCount: number;
  advisoryCount: number;
  completedStageCount: number;
};

function hasText(
  value: string | undefined
): boolean {
  return Boolean(value?.trim());
}

function stageCompletion({
  report,
  checklist,
}: {
  report: IncidentReport;
  checklist: ClosureChecklist;
}) {
  return {
    identity:
      hasText(report.region) &&
      hasText(report.ticket) &&
      hasText(report.summary),
    dispatch:
      hasText(report.occurTime) &&
      hasText(report.dispatchTime),
    progress:
      report.progress.length > 0,
    closure:
      closureChecklistComplete(checklist),
  } satisfies Record<ComposerFlowStageId, boolean>;
}

function stageDetail(
  id: ComposerFlowStageId,
  report: IncidentReport,
  checklist: ClosureChecklist
): string {
  switch (id) {
    case 'identity': {
      const completed = [
        report.region,
        report.ticket,
        report.summary,
      ].filter(hasText).length;

      return `${completed}/3 core identifiers`;
    }
    case 'dispatch': {
      const completed = [
        report.occurTime,
        report.dispatchTime,
      ].filter(hasText).length;

      return `${completed}/2 timing anchors`;
    }
    case 'progress':
      return `${report.progress.length} update${report.progress.length === 1 ? '' : 's'}`;
    case 'closure':
      return `${closureChecklistScore(checklist)}% complete`;
  }
}

function issueAction(
  issue: ComposerReadinessIssue
): ComposerFlowNextAction {
  return {
    id: issue.id,
    label: issue.label,
    detail: issue.detail,
    section: issue.section,
    tone:
      issue.severity === 'blocker'
        ? 'required'
        : 'advisory',
  };
}

export function buildComposerFlow(
  report: IncidentReport,
  checklist: ClosureChecklist
): ComposerFlow {
  const readiness =
    buildComposerReadiness(
      report,
      checklist
    );

  const completion =
    stageCompletion({
      report,
      checklist,
    });

  const orderedStageIds:
    ComposerFlowStageId[] = [
      'identity',
      'dispatch',
      'progress',
      'closure',
    ];

  const firstIncompleteIndex =
    orderedStageIds.findIndex(
      (id) => !completion[id]
    );

  const stages =
    orderedStageIds.map(
      (id, index): ComposerFlowStage => ({
        id,
        label:
          id === 'identity'
            ? 'Identity'
            : id === 'dispatch'
              ? 'Dispatch'
              : id === 'progress'
                ? 'Progress'
                : 'Closure',
        state: completion[id]
          ? 'complete'
          : index === firstIncompleteIndex
            ? 'current'
            : 'upcoming',
        detail:
          stageDetail(
            id,
            report,
            checklist
          ),
      })
    );

  const nextIssue =
    readiness.blockers[0] ??
    readiness.advisories[0];

  const nextAction:
    ComposerFlowNextAction =
    nextIssue
      ? issueAction(nextIssue)
      : {
          id: 'review-report',
          label: 'Review formatted report',
          detail:
            'Core readiness checks are clear. Review the live output before delivery.',
          section: 'preview',
          tone: 'ready',
        };

  return {
    stages,
    nextAction,
    reportScore:
      readiness.reportScore,
    closureScore:
      readiness.closureScore,
    blockerCount:
      readiness.blockers.length,
    advisoryCount:
      readiness.advisories.length,
    completedStageCount:
      orderedStageIds.filter(
        (id) => completion[id]
      ).length,
  };
}
