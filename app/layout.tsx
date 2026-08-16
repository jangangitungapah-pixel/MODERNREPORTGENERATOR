import type { Metadata } from 'next';

import {
  FirebaseCloudRecovery,
} from '@/components/firebase-cloud-recovery';

import './globals.css';
import './cloud-recovery.css';

export const metadata: Metadata = {
  title: 'ReportOS — Incident Report Workspace',
  description: 'A premium incident reporting workspace for NOC operations.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <FirebaseCloudRecovery />
      </body>
    </html>
  );
}
