import type {
  Metadata,
} from 'next';

import {
  BackboneImpactClientRuntime,
} from '@/components/backbone-impact-client-runtime';

export const metadata:
  Metadata = {
    title:
      'Backbone Impact Board — ReportOS',
    description:
      'Build, save, sync, and copy customer, tenant, and B2B impact lists for backbone outages.',
  };

export default function BackboneImpactPage() {
  return (
    <BackboneImpactClientRuntime />
  );
}
