import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  closureChecklistComplete,
  closureChecklistCompletedCount,
  closureChecklistScore,
  createDefaultClosureChecklist,
  matoaClearanceComplete,
  toggleClosureChecklistTask,
} from './closure';

describe('closure checklist', () => {
  it('starts empty and scores zero', () => {
    const checklist =
      createDefaultClosureChecklist();

    expect(
      closureChecklistCompletedCount(
        checklist
      )
    ).toBe(0);

    expect(
      closureChecklistScore(
        checklist
      )
    ).toBe(0);

    expect(
      closureChecklistComplete(
        checklist
      )
    ).toBe(false);
  });

  it('tracks each atomic task independently', () => {
    let checklist =
      createDefaultClosureChecklist();

    checklist =
      toggleClosureChecklistTask(
        checklist,
        'statementUpWag'
      );

    checklist =
      toggleClosureChecklistTask(
        checklist,
        'matoaStatusTt'
      );

    expect(
      closureChecklistCompletedCount(
        checklist
      )
    ).toBe(2);

    expect(
      closureChecklistScore(
        checklist
      )
    ).toBe(40);
  });

  it('treats Matoa Clearance as complete only when all three sub tasks pass', () => {
    let checklist =
      createDefaultClosureChecklist();

    checklist =
      toggleClosureChecklistTask(
        checklist,
        'matoaStatusTt'
      );

    checklist =
      toggleClosureChecklistTask(
        checklist,
        'matoaEventAndPhoto'
      );

    expect(
      matoaClearanceComplete(
        checklist
      )
    ).toBe(false);

    checklist =
      toggleClosureChecklistTask(
        checklist,
        'matoaRfo'
      );

    expect(
      matoaClearanceComplete(
        checklist
      )
    ).toBe(true);
  });

  it('reaches 100 percent only when all five atomic closure tasks are complete', () => {
    let checklist =
      createDefaultClosureChecklist();

    const tasks = [
      'statementUpWag',
      'matoaStatusTt',
      'matoaEventAndPhoto',
      'matoaRfo',
      'sentClosedEmail',
    ] as const;

    for (const task of tasks) {
      checklist =
        toggleClosureChecklistTask(
          checklist,
          task
        );
    }

    expect(
      closureChecklistScore(
        checklist
      )
    ).toBe(100);

    expect(
      closureChecklistComplete(
        checklist
      )
    ).toBe(true);
  });
});
