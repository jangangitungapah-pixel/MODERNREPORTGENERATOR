'use client';

import {
  useEffect,
  useState,
} from 'react';

import {
  currentIdentity,
  linkCurrentUserWithGoogle,
  signInWithGoogleIdentity,
  type IdentitySummary,
} from '@/lib/firebase-identity';

import styles from './reportos-identity.module.css';

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
        className={styles.trigger}
        type="button"
        onClick={() =>
          setOpen(true)
        }
      >
        <span
          className={styles.dot}
          aria-hidden="true"
        />
        Secure workspace
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
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="identity-title"
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
