import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  PROGRESS_MACROS,
  progressMacroSuggestions,
} from './progress-assistant';

describe('periodic update assistant', () => {
  it('keeps macro ids unique', () => {
    const ids =
      PROGRESS_MACROS.map(
        (macro) =>
          macro.id
      );

    expect(
      new Set(ids).size
    ).toBe(ids.length);
  });

  it('suggests operationally relevant next updates', () => {
    expect(
      progressMacroSuggestions(
        'dispatched'
      ).map(
        (macro) =>
          macro.id
      )
    ).toEqual([
      'otw',
      'onsite',
      'otdr-check',
    ]);

    expect(
      progressMacroSuggestions(
        'repair'
      ).map(
        (macro) =>
          macro.id
      )
    ).toEqual([
      'splicing',
      'link-test',
      'link-up',
    ]);

    expect(
      progressMacroSuggestions(
        'restored'
      ).map(
        (macro) =>
          macro.id
      )
    ).toEqual([
      'monitoring',
    ]);
  });
});
