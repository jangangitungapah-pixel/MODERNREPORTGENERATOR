import type { Metadata } from 'next';

import {
  FirebaseCloudRecovery,
} from '@/components/firebase-cloud-recovery';

import {
  ReportOsCanonicalSync,
} from '@/components/reportos-canonical-sync';

import './globals.css';
import './cloud-recovery.css';

export const metadata: Metadata = {
  title: 'ReportOS — Incident Operations Platform',
  description: 'A professional full-stack incident operations platform for NOC workflows.',
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
        <ReportOsCanonicalSync />
        <FirebaseCloudRecovery />
      </body>
    </html>
  );
}
