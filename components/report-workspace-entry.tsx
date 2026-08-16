'use client';

import {
  useEffect,
} from 'react';

import {
  ReportWorkspace,
} from '@/components/report-workspace';

const ROUTE_LABELS: Record<
  string,
  string
> = {
  composer: 'Composer',
  operations: 'Operations',
  archive: 'Archive',
};

export function ReportWorkspaceEntry() {
  useEffect(() => {
    const requested =
      new URLSearchParams(
        window.location.search
      ).get('workspace');

    if (!requested) {
      return;
    }

    const label =
      ROUTE_LABELS[requested];

    if (!label) {
      return;
    }

    const timer =
      window.setTimeout(
        () => {
          const candidates =
            Array.from(
              document.querySelectorAll<HTMLElement>(
                '.side-nav .nav-item'
              )
            );

          const target =
            candidates.find(
              (element) =>
                element
                  .querySelector(
                    '.nav-copy strong'
                  )
                  ?.textContent
                  ?.trim() === label
            );

          target?.click();
        },
        0
      );

    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, []);

  return <ReportWorkspace />;
}
