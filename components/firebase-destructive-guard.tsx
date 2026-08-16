'use client';

import {
  useEffect,
} from 'react';

import {
  ensureFirebaseUser,
} from '@/lib/firebase-client';

import {
  loadCloudWorkspace,
  syncCloudWorkspace,
} from '@/lib/firebase-workspace-sync';

import {
  snapshotActiveIncident,
} from '@/lib/firebase-safety-snapshot';

const WORKSPACE_STORAGE_KEY =
  'reportos:workspace:v1';

const IMPACT_STORAGE_KEY =
  'reportos:backbone-impact:v1';

type PendingSnapshot = {
  workspaceRaw: string | null;
  reason: string;
};

function destructiveReason(
  target: EventTarget | null
): string | null {
  if (
    !(target instanceof Element)
  ) {
    return null;
  }

  const button =
    target.closest(
      'button'
    );

  if (!button) {
    return null;
  }

  const title =
    button
      .getAttribute(
        'title'
      )
      ?.trim()
      .toLowerCase() ??
    '';

  const text =
    button.textContent
      ?.replace(/\s+/g, ' ')
      .trim()
      .toLowerCase() ??
    '';

  if (
    title === 'load sample' ||
    text === 'load sample'
  ) {
    return 'Safety snapshot before Load sample / Reset';
  }

  if (
    text === 'clear' ||
    text === 'clear draft' ||
    text === 'reset draft'
  ) {
    return 'Safety snapshot before Clear / Reset';
  }

  return null;
}

export function FirebaseDestructiveGuard() {
  useEffect(() => {
    let cancelled = false;
    let userId = '';

    const pending:
      PendingSnapshot[] = [];

    function protectClick(
      event: MouseEvent
    ) {
      const reason =
        destructiveReason(
          event.target
        );

      if (!reason) {
        return;
      }

      const workspaceRaw =
        window.localStorage.getItem(
          WORKSPACE_STORAGE_KEY
        );

      if (userId) {
        void snapshotActiveIncident({
          uid: userId,
          workspaceRaw,
          reason,
        });

        return;
      }

      pending.push({
        workspaceRaw,
        reason,
      });
    }

    document.addEventListener(
      'click',
      protectClick,
      true
    );

    async function bootstrapGuard() {
      try {
        const user =
          await ensureFirebaseUser();

        if (cancelled) {
          return;
        }

        userId = user.uid;

        const cloud =
          await loadCloudWorkspace(
            user.uid
          );

        if (cancelled) {
          return;
        }

        const localWorkspace =
          window.localStorage.getItem(
            WORKSPACE_STORAGE_KEY
          );

        const localImpact =
          window.localStorage.getItem(
            IMPACT_STORAGE_KEY
          );

        if (
          localWorkspace &&
          !cloud.workspaceRaw
        ) {
          await syncCloudWorkspace({
            uid: user.uid,
            workspaceRaw:
              localWorkspace,
            impactRaw:
              localImpact,
            previousWorkspaceRaw:
              null,
            previousImpactRaw:
              cloud.impactRaw,
          });
        }

        for (
          const item of pending.splice(
            0
          )
        ) {
          await snapshotActiveIncident({
            uid: user.uid,
            workspaceRaw:
              item.workspaceRaw,
            reason:
              item.reason,
          });
        }
      } catch {
        // Local autosave remains the fallback when Firebase is unavailable.
      }
    }

    void bootstrapGuard();

    return () => {
      cancelled = true;

      document.removeEventListener(
        'click',
        protectClick,
        true
      );
    };
  }, []);

  return null;
}
