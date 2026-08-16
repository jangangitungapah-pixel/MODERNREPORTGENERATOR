export type ClosureChecklist = {
  statementUpWag: boolean;
  matoaClearance: {
    statusTt: boolean;
    eventAndPhoto: boolean;
    rfo: boolean;
  };
  sentClosedEmail: boolean;
};

export type ClosureTaskKey =
  | 'statementUpWag'
  | 'matoaStatusTt'
  | 'matoaEventAndPhoto'
  | 'matoaRfo'
  | 'sentClosedEmail';

export const CLOSURE_ATOMIC_TASK_COUNT = 5;

export function createDefaultClosureChecklist(): ClosureChecklist {
  return {
    statementUpWag: false,
    matoaClearance: {
      statusTt: false,
      eventAndPhoto: false,
      rfo: false,
    },
    sentClosedEmail: false,
  };
}

export function closureChecklistCompletedCount(
  checklist: ClosureChecklist
): number {
  return [
    checklist.statementUpWag,
    checklist.matoaClearance.statusTt,
    checklist.matoaClearance.eventAndPhoto,
    checklist.matoaClearance.rfo,
    checklist.sentClosedEmail,
  ].filter(Boolean).length;
}

export function closureChecklistScore(
  checklist: ClosureChecklist
): number {
  return Math.round(
    (
      closureChecklistCompletedCount(
        checklist
      ) /
      CLOSURE_ATOMIC_TASK_COUNT
    ) *
      100
  );
}

export function closureChecklistComplete(
  checklist: ClosureChecklist
): boolean {
  return (
    closureChecklistCompletedCount(
      checklist
    ) ===
    CLOSURE_ATOMIC_TASK_COUNT
  );
}

export function matoaClearanceComplete(
  checklist: ClosureChecklist
): boolean {
  return (
    checklist.matoaClearance.statusTt &&
    checklist.matoaClearance.eventAndPhoto &&
    checklist.matoaClearance.rfo
  );
}

export function matoaClearanceCompletedCount(
  checklist: ClosureChecklist
): number {
  return [
    checklist.matoaClearance.statusTt,
    checklist.matoaClearance.eventAndPhoto,
    checklist.matoaClearance.rfo,
  ].filter(Boolean).length;
}

export function toggleClosureChecklistTask(
  checklist: ClosureChecklist,
  task: ClosureTaskKey
): ClosureChecklist {
  if (task === 'statementUpWag') {
    return {
      ...checklist,
      statementUpWag:
        !checklist.statementUpWag,
    };
  }

  if (task === 'matoaStatusTt') {
    return {
      ...checklist,
      matoaClearance: {
        ...checklist.matoaClearance,
        statusTt:
          !checklist.matoaClearance.statusTt,
      },
    };
  }

  if (task === 'matoaEventAndPhoto') {
    return {
      ...checklist,
      matoaClearance: {
        ...checklist.matoaClearance,
        eventAndPhoto:
          !checklist.matoaClearance.eventAndPhoto,
      },
    };
  }

  if (task === 'matoaRfo') {
    return {
      ...checklist,
      matoaClearance: {
        ...checklist.matoaClearance,
        rfo:
          !checklist.matoaClearance.rfo,
      },
    };
  }

  return {
    ...checklist,
    sentClosedEmail:
      !checklist.sentClosedEmail,
  };
}

export function isClosureChecklist(
  value: unknown
): value is ClosureChecklist {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false;
  }

  const checklist =
    value as Record<
      string,
      unknown
    >;

  const matoa =
    checklist.matoaClearance;

  if (
    typeof matoa !== 'object' ||
    matoa === null
  ) {
    return false;
  }

  const matoaChecklist =
    matoa as Record<
      string,
      unknown
    >;

  return (
    typeof checklist.statementUpWag ===
      'boolean' &&
    typeof matoaChecklist.statusTt ===
      'boolean' &&
    typeof matoaChecklist.eventAndPhoto ===
      'boolean' &&
    typeof matoaChecklist.rfo ===
      'boolean' &&
    typeof checklist.sentClosedEmail ===
      'boolean'
  );
}
