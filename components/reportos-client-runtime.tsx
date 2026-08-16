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

export function ReportOsClientRuntime() {
  return (
    <>
      <ReportOsUtilityDock />
      <ComposerOperatorDeck />
    </>
  );
}
