import type {
  Metadata,
} from 'next';

import {
  BackboneImpactBoard,
} from '@/components/backbone-impact-board';

export const metadata:
  Metadata = {
    title:
      'Backbone Impact Board — ReportOS',
    description:
      'Build and copy customer, tenant, and B2B impact lists for backbone outages.',
  };

export default function BackboneImpactPage() {
  return (
    <BackboneImpactBoard />
  );
}
