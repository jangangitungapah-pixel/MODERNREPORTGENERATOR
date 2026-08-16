'use client';

import dynamic from 'next/dynamic';

const ReportOsUtilityDock = dynamic(
  () =>
    import('./reportos-utility-dock').then(
      (module) => module.ReportOsUtilityDock
    ),
  { ssr: false }
);

export function ReportOsClientRuntime() {
  return <ReportOsUtilityDock />;
}
