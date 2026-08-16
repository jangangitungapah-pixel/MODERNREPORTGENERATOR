import type { Metadata } from 'next';

import {
  FirebaseCloudRecovery,
} from '@/components/firebase-cloud-recovery';

import {
  ReportOsCanonicalSync,
} from '@/components/reportos-canonical-sync';

import {
  ReportOsIdentity,
} from '@/components/reportos-identity';

import {
  ReportOsIntelligence,
} from '@/components/reportos-intelligence';

import {
  ReportOsSystemLink,
} from '@/components/reportos-system-link';

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
        <ReportOsSystemLink />
        <ReportOsIdentity />
        <ReportOsIntelligence />
        <ReportOsCanonicalSync />
        <FirebaseCloudRecovery />
      </body>
    </html>
  );
}
