'use client';

import dynamic from 'next/dynamic';

const ReportOsUtilityDock = dynamic(
  () =>
    import('./reportos-utility-dock').then(
      (module) => module.ReportOsUtilityDock
    ),
  { ssr: false }
);

const ComposerOperatorDeck = dynamic(
  () =>
    import('./composer-operator-deck').then(
      (module) => module.ComposerOperatorDeck
    ),
  { ssr: false }
);

const ComposerFlowGuide = dynamic(
  () =>
    import('./composer-flow-guide').then(
      (module) => module.ComposerFlowGuide
    ),
  { ssr: false }
);

const SavedTTLibraryControl = dynamic(
  () =>
    import('./saved-tt-library-control').then(
      (module) => module.SavedTTLibraryControl
    ),
  { ssr: false }
);

export function ReportOsClientRuntime() {
  return (
    <>
      <ReportOsUtilityDock />
      <ComposerOperatorDeck />
      <ComposerFlowGuide />
      <SavedTTLibraryControl />
    </>
  );
}
