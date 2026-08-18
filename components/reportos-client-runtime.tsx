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
      <SavedTTLibraryControl />
    </>
  );
}

// REPORTOS_COMPOSER_UNIFIED_FLOW_V3: guided flow is merged into Composer Operator Control.
