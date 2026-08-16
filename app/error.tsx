'use client';

import styles from './error.module.css';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
}) {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <span
          className={styles.eyebrow}
        >
          REPORTOS RECOVERY MODE
        </span>

        <h1>
          This view could not finish loading
        </h1>

        <p>
          Your local workspace cache is not cleared by this screen. Retry the view first; if the problem persists, open System Console to inspect server and recovery state.
        </p>

        <div
          className={styles.reference}
        >
          {error.digest ??
            error.message}
        </div>

        <div
          className={styles.actions}
        >
          <button
            type="button"
            onClick={reset}
          >
            Retry view
          </button>

          <a href="/system">
            System Console
          </a>
        </div>
      </section>
    </main>
  );
}
