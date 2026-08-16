export type ImpactStatus =
  | 'up'
  | 'pending'
  | 'down'
  | 'warning'
  | 'unknown';

export type BackboneImpactService = {
  id: string;
  name: string;
  status: ImpactStatus;
  note: string;
};

export type BackboneImpactCustomer = {
  id: string;
  name: string;
  status: ImpactStatus;
  note: string;
  services: BackboneImpactService[];
};

export type BackboneImpactDraft = {
  title: string;
  customers: BackboneImpactCustomer[];
};

export type BackboneImpactStats = {
  total: number;
  up: number;
  pending: number;
  down: number;
  warning: number;
  unknown: number;
};

export const IMPACT_STATUS_OPTIONS: Array<{
  value: ImpactStatus;
  label: string;
  symbol: string;
}> = [
  {
    value: 'up',
    label: 'UP',
    symbol: '✅',
  },
  {
    value: 'pending',
    label: 'Pending',
    symbol: '⏳',
  },
  {
    value: 'down',
    label: 'Down',
    symbol: '❌',
  },
  {
    value: 'warning',
    label: 'Warning',
    symbol: '⚠️',
  },
  {
    value: 'unknown',
    label: 'Unknown',
    symbol: '•',
  },
];

export const SAMPLE_BACKBONE_IMPACT:
  BackboneImpactDraft = {
    title: 'UJB tegal - pekalongan',
    customers: [
      {
        id: 'customer-h3i',
        name: 'H3I',
        status: 'up',
        note: '',
        services: [],
      },
      {
        id: 'customer-asianet',
        name: 'ASIANET',
        status: 'pending',
        note: '',
        services: [],
      },
      {
        id: 'customer-iforte',
        name: 'IFORTE',
        status: 'unknown',
        note: '',
        services: [
          {
            id: 'iforte-jvbb',
            name: 'JVBB',
            status: 'down',
            note: 'RX pekalongan',
          },
          {
            id: 'iforte-new-jvbb',
            name: 'new JVBB',
            status: 'up',
            note: '',
          },
        ],
      },
      {
        id: 'customer-fiberstar',
        name: 'FIBERSTAR',
        status: 'unknown',
        note: '',
        services: [
          {
            id: 'fiberstar-ujb',
            name: 'UJB',
            status: 'up',
            note: '',
          },
          {
            id: 'fiberstar-uajb',
            name: 'UAJB',
            status: 'up',
            note: '',
          },
          {
            id: 'fiberstar-uajbf',
            name: 'UAJBF',
            status: 'warning',
            note:
              'RX pekalongan 0.7 db',
          },
        ],
      },
    ],
  };

export const EMPTY_BACKBONE_IMPACT:
  BackboneImpactDraft = {
    title: '',
    customers: [],
  };

export function impactStatusSymbol(
  status: ImpactStatus
): string {
  return (
    IMPACT_STATUS_OPTIONS.find(
      (option) =>
        option.value === status
    )?.symbol ?? '•'
  );
}

function clean(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim();
}

function formatLeaf(
  name: string,
  status: ImpactStatus,
  note: string
): string {
  const safeName = clean(name);
  const safeNote = clean(note);

  return [
    safeName,
    impactStatusSymbol(status),
    safeNote
      ? '(' + safeNote + ')'
      : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function formatBackboneImpact(
  draft: BackboneImpactDraft
): string {
  const title = clean(draft.title);

  const groups = draft.customers
    .map((customer, index) => {
      const name = clean(customer.name);

      if (!name) {
        return '';
      }

      if (
        customer.services.length === 0
      ) {
        return (
          String(index + 1) +
          '.' +
          formatLeaf(
            name,
            customer.status,
            customer.note
          )
        );
      }

      const childLines =
        customer.services
          .filter(
            (service) =>
              clean(service.name)
          )
          .map(
            (service) =>
              '- ' +
              formatLeaf(
                service.name,
                service.status,
                service.note
              )
          );

      if (childLines.length === 0) {
        return (
          String(index + 1) +
          '.' +
          formatLeaf(
            name,
            customer.status,
            customer.note
          )
        );
      }

      return [
        String(index + 1) +
          '.' +
          name,
        ...childLines,
      ].join('\n');
    })
    .filter(Boolean);

  return [
    title
      ? '*' + title + '*'
      : '*Untitled backbone*',
    '',
    groups.join('\n\n'),
  ]
    .join('\n')
    .trimEnd();
}

export function backboneImpactStats(
  draft: BackboneImpactDraft
): BackboneImpactStats {
  const statuses: ImpactStatus[] = [];

  for (const customer of draft.customers) {
    if (customer.services.length > 0) {
      for (
        const service of
        customer.services
      ) {
        if (clean(service.name)) {
          statuses.push(
            service.status
          );
        }
      }

      continue;
    }

    if (clean(customer.name)) {
      statuses.push(
        customer.status
      );
    }
  }

  return {
    total: statuses.length,
    up:
      statuses.filter(
        (status) =>
          status === 'up'
      ).length,
    pending:
      statuses.filter(
        (status) =>
          status === 'pending'
      ).length,
    down:
      statuses.filter(
        (status) =>
          status === 'down'
      ).length,
    warning:
      statuses.filter(
        (status) =>
          status === 'warning'
      ).length,
    unknown:
      statuses.filter(
        (status) =>
          status === 'unknown'
      ).length,
  };
}
