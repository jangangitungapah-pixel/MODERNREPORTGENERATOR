import type { Metadata } from 'next';
import './globals.css';

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
      <body>{children}</body>
    </html>
  );
}
