import Link from 'next/link';

import {
  Settings2,
} from 'lucide-react';

import styles from './reportos-system-link.module.css';

export function ReportOsSystemLink() {
  return (
    <Link
      className={styles.link}
      href="/system"
    >
      <Settings2 size={12} />
      System Console
    </Link>
  );
}
