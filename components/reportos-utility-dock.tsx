'use client';

import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  usePathname,
} from 'next/navigation';

import {
  FirebaseCloudRecovery,
} from './firebase-cloud-recovery';
import {
  ReportOsCanonicalSync,
} from './reportos-canonical-sync';
import {
  ReportOsIdentity,
} from './reportos-identity';
import {
  ReportOsIntelligence,
} from './reportos-intelligence';
import {
  ReportOsSystemLink,
} from './reportos-system-link';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusFirstChildDialog(): void {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const dialogs = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[role="dialog"]'
        )
      ).filter(
        (dialog) =>
          dialog.id !==
          'reportos-system-status-sheet'
      );

      const dialog =
        dialogs[dialogs.length - 1];

      dialog
        ?.querySelector<HTMLElement>(
          FOCUSABLE_SELECTOR
        )
        ?.focus();
    });
  });
}

export function ReportOsUtilityDock() {
  const pathname = usePathname();

  const [mobileOpen, setMobileOpen] =
    useState(false);

  const [mobileViewport, setMobileViewport] =
    useState(() =>
      typeof window !== 'undefined'
        ? window.matchMedia(
            '(max-width: 1023px)'
          ).matches
        : false
    );

  const triggerRef =
    useRef<HTMLButtonElement>(null);

  const sheetRef =
    useRef<HTMLElement>(null);

  const closeRef =
    useRef<HTMLButtonElement>(null);

  const returnFocusRef =
    useRef<HTMLElement | null>(null);

  const restoreFocusRef =
    useRef(true);

  useEffect(() => {
    const media = window.matchMedia(
      '(max-width: 1023px)'
    );

    const syncViewport = () => {
      setMobileViewport(media.matches);

      if (!media.matches) {
        setMobileOpen(false);
      }
    };

    syncViewport();
    media.addEventListener(
      'change',
      syncViewport
    );

    return () => {
      media.removeEventListener(
        'change',
        syncViewport
      );
    };
  }, []);

  useEffect(() => {
    const openFromShell = () => {
      if (
        !window.matchMedia(
          '(max-width: 1023px)'
        ).matches
      ) {
        return;
      }

      returnFocusRef.current =
        document.activeElement instanceof
        HTMLElement
          ? document.activeElement
          : null;

      restoreFocusRef.current = true;
      setMobileOpen(true);
    };

    window.addEventListener(
      'reportos:open-utility-dock',
      openFromShell
    );

    return () => {
      window.removeEventListener(
        'reportos:open-utility-dock',
        openFromShell
      );
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    const triggerFallback =
      triggerRef.current;

    document.body.style.overflow =
      'hidden';

    const focusFrame =
      window.requestAnimationFrame(() => {
        closeRef.current?.focus();
      });

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      const childDialog =
        sheetRef.current?.querySelector(
          '[role="dialog"]'
        );

      if (childDialog) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }

      if (
        event.key !== 'Tab' ||
        !sheetRef.current
      ) {
        return;
      }

      const focusable = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(
          FOCUSABLE_SELECTOR
        )
      ).filter(
        (element) =>
          !element.hasAttribute(
            'disabled'
          )
      );

      if (focusable.length === 0) {
        event.preventDefault();
        sheetRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last =
        focusable[
          focusable.length - 1
        ];

      if (
        event.shiftKey &&
        document.activeElement === first
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener(
      'keydown',
      handleKeyDown
    );

    return () => {
      window.cancelAnimationFrame(
        focusFrame
      );

      document.removeEventListener(
        'keydown',
        handleKeyDown
      );

      document.body.style.overflow =
        previousOverflow;

      if (restoreFocusRef.current) {
        const target =
          returnFocusRef.current;

        if (target?.isConnected) {
          target.focus();
        } else {
          triggerFallback?.focus();
        }
      }
    };
  }, [mobileOpen]);

  const openFromTrigger = () => {
    returnFocusRef.current =
      triggerRef.current;

    restoreFocusRef.current = true;
    setMobileOpen(true);
  };

  const handleUtilitySelection = (
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const control = event.target.closest<HTMLElement>(
      'button, a'
    );

    if (
      !control ||
      control.parentElement !==
        event.currentTarget
    ) {
      return;
    }

    if (control.tagName === 'A') {
      restoreFocusRef.current = false;
      setMobileOpen(false);
      return;
    }

    focusFirstChildDialog();
  };

  return (
    <div
      className={`reportos-utility-dock${
        pathname === '/'
          ? ' reportos-utility-dock--workspace'
          : ''
      }`}
      data-pathname={pathname}
    >
      <button
        ref={triggerRef}
        className="reportos-utility-mobile-trigger"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={mobileOpen}
        aria-controls="reportos-system-status-sheet"
        onClick={openFromTrigger}
      >
        <ShieldCheck size={17} />
        System status
      </button>

      {mobileOpen && mobileViewport ? (
        <div
          className="reportos-utility-sheet-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setMobileOpen(false);
            }
          }}
        />
      ) : null}

      <aside
        ref={sheetRef}
        className={`reportos-utility-surface${
          mobileOpen
            ? ' reportos-utility-surface--open'
            : ''
        }`}
        id="reportos-system-status-sheet"
        role={
          mobileViewport
            ? 'dialog'
            : undefined
        }
        aria-modal={
          mobileViewport && mobileOpen
            ? true
            : undefined
        }
        aria-label={
          mobileViewport
            ? undefined
            : 'ReportOS system utilities'
        }
        aria-labelledby={
          mobileViewport
            ? 'reportos-system-status-title'
            : undefined
        }
        aria-describedby={
          mobileViewport
            ? 'reportos-system-status-description'
            : undefined
        }
        aria-hidden={
          mobileViewport && !mobileOpen
            ? true
            : undefined
        }
        tabIndex={
          mobileViewport ? -1 : undefined
        }
      >
        <header className="reportos-utility-sheet-head">
          <div>
            <span>REPORTOS CONTROL PLANE</span>
            <h2 id="reportos-system-status-title">
              System status
            </h2>
            <p id="reportos-system-status-description">
              Review canonical sync, identity,
              intelligence, and recovery from one
              place.
            </p>
          </div>

          <button
            ref={closeRef}
            type="button"
            aria-label="Close system status"
            onClick={() =>
              setMobileOpen(false)
            }
          >
            <X size={18} />
          </button>
        </header>

        <div className="reportos-utility-sheet-status">
          <ReportOsCanonicalSync />
        </div>

        <div
          className="reportos-utility-sheet-actions reportos-utility-trigger-group"
          onClick={
            mobileViewport
              ? handleUtilitySelection
              : undefined
          }
        >
          <ReportOsSystemLink />
          <ReportOsIdentity />
          <ReportOsIntelligence />
          <FirebaseCloudRecovery />
        </div>
      </aside>
    </div>
  );
}
