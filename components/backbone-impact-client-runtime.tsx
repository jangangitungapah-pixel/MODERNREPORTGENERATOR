'use client';

import dynamic from 'next/dynamic';

const BackboneImpactWorkspace = dynamic(
  () =>
    import('./backbone-impact-workspace').then(
      (module) => module.BackboneImpactWorkspace
    ),
  {
    ssr: false,
    loading: () => (
      <div className="impact-client-runtime-loading">
        <strong>Opening Impact Board</strong>
        <span>Starting the secure browser workspace…</span>
      </div>
    ),
  }
);

export function BackboneImpactClientRuntime() {
  return <BackboneImpactWorkspace />;
}
