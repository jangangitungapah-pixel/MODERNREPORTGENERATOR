'use client';

import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  currentIdentity,
  linkCurrentUserWithGoogle,
  signInWithGoogleIdentity,
  type IdentitySummary,
} from '@/lib/firebase-identity';

import styles from './reportos-identity.module.css';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ReportOsIdentity() {
  const [
    identity,
    setIdentity,
  ] = useState<IdentitySummary | null>(
    null
  );

  const [open, setOpen] =
    useState(false);

  const [busy, setBusy] =
    useState(false);

  const triggerRef =
    useRef<HTMLButtonElement>(null);

  const dialogRef =
    useRef<HTMLElement>(null);

  const dismissRef =
    useRef<HTMLButtonElement>(null);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    void currentIdentity()
      .then((value) => {
        if (!cancelled) {
          setIdentity(value);
        }
      })
      .catch(() => {
        // Identity bootstrap is handled by the canonical sync controller.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    const returnFocusTarget =
      triggerRef.current;

    document.body.style.overflow =
      'hidden';

    const focusFrame =
      window.requestAnimationFrame(
        () => {
          dismissRef.current?.focus();
        }
      );

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (
        event.key !== 'Tab' ||
        !dialogRef.current
      ) {
        return;
      }

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          FOCUSABLE_SELECTOR
        )
      );

      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last =
        focusable[focusable.length - 1];

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
      if (returnFocusTarget?.isConnected) {
        returnFocusTarget.focus();
      }
    };
  }, [open]);

  if (
    !identity ||
    !identity.anonymous
  ) {
    return null;
  }

  const handleLink = async () => {
    setBusy(true);
    setError(null);

    try {
      const next =
        await linkCurrentUserWithGoogle();

      setIdentity(next);
      setOpen(false);

      window.location.reload();
    } catch (linkError) {
      setError(
        linkError instanceof Error
          ? linkError.message
          : 'Google account linking failed.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSignIn = async () => {
    setBusy(true);
    setError(null);

    try {
      const next =
        await signInWithGoogleIdentity();

      setIdentity(next);
      setOpen(false);

      window.location.reload();
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : 'Google sign-in failed.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        className={styles.trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="reportos-identity-dialog"
        aria-label="Secure workspace identity"
        onClick={() =>
          setOpen(true)
        }
      >
        <span
          className={styles.dot}
          aria-hidden="true"
        />
        Identity
      </button>

      {open ? (
        <div
          className={styles.overlay}
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setOpen(false);
            }
          }}
        >
          <section
            ref={dialogRef}
            id="reportos-identity-dialog"
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="identity-title"
            tabIndex={-1}
          >
            <span
              className={styles.eyebrow}
            >
              ACCOUNT SECURITY
            </span>

            <h2 id="identity-title">
              Secure this ReportOS identity
            </h2>

            <p>
              Link the current anonymous workspace to Google to preserve the same UID, or sign in to a Google identity that was already linked on another browser or device. When an existing identity has canonical D1 data, the server copy wins safely after reload.
            </p>

            <div
              className={styles.identity}
            >
              <span>CURRENT UID</span>
              <strong>
                {identity.uid}
              </strong>
            </div>

            {error ? (
              <div
                className={styles.error}
              >
                {error}
              </div>
            ) : null}

            <div
              className={styles.actions}
            >
              <button
                ref={dismissRef}
                type="button"
                disabled={busy}
                onClick={() =>
                  setOpen(false)
                }
              >
                Not now
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void handleLink();
                }}
              >
                {busy
                  ? 'Working…'
                  : 'Link this workspace'}
              </button>

              <button
                className={styles.signIn}
                type="button"
                disabled={busy}
                onClick={() => {
                  void handleSignIn();
                }}
              >
                {busy
                  ? 'Working…'
                  : 'Sign in to existing Google identity'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
