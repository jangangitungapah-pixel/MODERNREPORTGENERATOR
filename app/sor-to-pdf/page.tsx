import type {
  Metadata,
} from 'next';

import {
  SorPdfConverter,
} from '@/components/sor-pdf-converter';

export const metadata:
  Metadata = {
    title:
      'SOR to PDF — ReportOS Fiber Lab',
    description:
      'Convert OTDR SOR files into trace-rich PDF reports locally in the browser.',
  };

export default function SorToPdfPage() {
  return (
    <SorPdfConverter />
  );
}
