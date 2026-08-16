import Link from 'next/link';

import styles from './error.module.css';

export default function NotFound() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <span
          className={styles.eyebrow}
        >
          REPORTOS ROUTING
        </span>

        <h1>
          This workspace route does not exist
        </h1>

        <p>
          Return to Operations or open System Console. No draft or canonical incident data was modified.
        </p>

        <div
          className={styles.actions}
        >
          <Link href="/">
            Back to Operations
          </Link>
          <Link href="/system">
            System Console
          </Link>
        </div>
      </section>
    </main>
  );
}
