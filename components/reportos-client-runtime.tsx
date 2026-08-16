'use client';

import dynamic from 'next/dynamic';

const ReportOsCanonicalSync = dynamic(
  () =>
    import('./reportos-canonical-sync').then(
      (module) => module.ReportOsCanonicalSync
    ),
  { ssr: false }
);

const ReportOsIdentity = dynamic(
  () =>
    import('./reportos-identity').then(
      (module) => module.ReportOsIdentity
    ),
  { ssr: false }
);

const FirebaseCloudRecovery = dynamic(
  () =>
    import('./firebase-cloud-recovery').then(
      (module) => module.FirebaseCloudRecovery
    ),
  { ssr: false }
);

export function ReportOsClientRuntime() {
  return (
    <>
      <ReportOsIdentity />
      <ReportOsCanonicalSync />
      <FirebaseCloudRecovery />
    </>
  );
}
