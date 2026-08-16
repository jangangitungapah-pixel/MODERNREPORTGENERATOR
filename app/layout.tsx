import type { Metadata } from 'next';

import {
  ReportOsClientRuntime,
} from '@/components/reportos-client-runtime';

import './globals.css';
import './cloud-recovery.css';
import './ui-overhaul.css';
import './ui-overhaul-detail.css';
import './ui-navbar-premium.css';
import './styles/tokens.css';
import './styles/primitives.css';
import './styles/shell.css';
import './styles/composer.css';
import './styles/operations.css';
import './styles/archive.css';
import './styles/impact-board.css';
import './styles/fiber-lab.css';
import './styles/utilities.css';
import './ui-composer-ultra-premium.css';

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
        <ReportOsClientRuntime />
      </body>
    </html>
  );
}
