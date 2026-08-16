import type { Metadata } from 'next';

import {
  ReportOsClientRuntime,
} from '@/components/reportos-client-runtime';

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
        <ReportOsIntelligence />
        <ReportOsClientRuntime />
      </body>
    </html>
  );
}
