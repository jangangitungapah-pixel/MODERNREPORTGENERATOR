import type {
  OperationalStatus,
} from './operations';

import type {
  ProgressKind,
} from './report';

export type ProgressMacro = {
  id: string;
  label: string;
  text: string;
  kind: ProgressKind;
};

export const PROGRESS_MACROS:
  ProgressMacro[] = [
    {
      id: 'prepare-tools',
      label: 'Prepare tools',
      text:
        'Team prepare tools',
      kind:
        'coordination',
    },
    {
      id: 'otw',
      label: 'Team OTW',
      text:
        'Team OTW location',
      kind:
        'dispatch',
    },
    {
      id: 'onsite',
      label: 'Arrived onsite',
      text:
        'Team arrived on location and start checking',
      kind:
        'onsite',
    },
    {
      id: 'otdr-check',
      label: 'OTDR check',
      text:
        'Team on location checking using OTDR',
      kind:
        'onsite',
    },
    {
      id: 'cut-found',
      label: 'Found cut point',
      text:
        'Team found cut point',
      kind:
        'onsite',
    },
    {
      id: 'prepare-material',
      label: 'Prepare material',
      text:
        'Team prepare material for repair',
      kind:
        'repair',
    },
    {
      id: 'splicing',
      label: 'Start splicing',
      text:
        'Team start splicing cable',
      kind:
        'repair',
    },
    {
      id: 'link-test',
      label: 'Link test',
      text:
        'Team testing link after repair',
      kind:
        'repair',
    },
    {
      id: 'link-up',
      label: 'Link UP',
      text:
        'Link already up.',
      kind:
        'restored',
    },
    {
      id: 'monitoring',
      label: 'Monitoring',
      text:
        'Team monitoring link stability',
      kind:
        'update',
    },
  ];

const MACRO_BY_ID =
  new Map(
    PROGRESS_MACROS.map(
      (macro) => [
        macro.id,
        macro,
      ]
    )
  );

const SUGGESTIONS:
  Record<
    OperationalStatus,
    string[]
  > = {
    new: [
      'prepare-tools',
      'otw',
      'onsite',
    ],
    dispatched: [
      'otw',
      'onsite',
      'otdr-check',
    ],
    onsite: [
      'otdr-check',
      'cut-found',
      'prepare-material',
    ],
    repair: [
      'splicing',
      'link-test',
      'link-up',
    ],
    restored: [
      'monitoring',
    ],
  };

export function progressMacroSuggestions(
  status: OperationalStatus
): ProgressMacro[] {
  return SUGGESTIONS[
    status
  ]
    .map(
      (id) =>
        MACRO_BY_ID.get(id)
    )
    .filter(
      (
        macro
      ): macro is ProgressMacro =>
        macro !== undefined
    );
}
