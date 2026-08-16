import Link from 'next/link';

import {
  Archive,
  ChevronRight,
  FileOutput,
  Gauge,
  Network,
  WandSparkles,
} from 'lucide-react';

type RouteSidebarProps = {
  active:
    | 'composer'
    | 'operations'
    | 'archive'
    | 'impact'
    | 'fiber';
};

const items = [
  {
    key: 'composer',
    label: 'Composer',
    detail: 'Build incident report',
    href: '/',
    icon: WandSparkles,
  },
  {
    key: 'operations',
    label: 'Operations',
    detail: 'Live command center',
    href: '/?workspace=operations',
    icon: Gauge,
  },
  {
    key: 'archive',
    label: 'Archive',
    detail: 'Incident vault',
    href: '/?workspace=archive',
    icon: Archive,
  },
  {
    key: 'impact',
    label: 'Impact Board',
    detail: 'Backbone B2B impact',
    href: '/backbone-impact',
    icon: Network,
  },
  {
    key: 'fiber',
    label: 'SOR → PDF',
    detail: 'OTDR fiber lab',
    href: '/sor-to-pdf',
    icon: FileOutput,
  },
] as const;

export function ReportOsRouteSidebar({
  active,
}: RouteSidebarProps) {
  return (
    <aside className="sidebar reportos-route-sidebar">
      <Link
        className="brand-lockup reportos-route-brand"
        href="/"
        aria-label="ReportOS Composer"
      >
        <span
          className="app-mark"
          aria-hidden="true"
        >
          <span className="app-mark-core" />
          <span className="app-mark-orbit app-mark-orbit-one" />
          <span className="app-mark-orbit app-mark-orbit-two" />
        </span>

        <span className="brand-copy">
          <strong>ReportOS</strong>
          <span>Ops Intelligence</span>
        </span>
      </Link>

      <nav
        className="side-nav"
        aria-label="ReportOS workspace"
      >
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            active === item.key;

          return (
            <Link
              className={
                isActive
                  ? 'nav-item nav-item-active'
                  : 'nav-item'
              }
              href={item.href}
              key={item.key}
              aria-current={
                isActive
                  ? 'page'
                  : undefined
              }
            >
              <Icon size={18} />

              <span className="nav-copy">
                <strong>
                  {item.label}
                </strong>
                <small>
                  {item.detail}
                </small>
              </span>

              <ChevronRight
                className="nav-chevron"
                size={14}
              />
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-spacer" />

      <div className="sidebar-status">
        <span
          className="status-orb"
          aria-hidden="true"
        />
        <span className="sidebar-foot-copy">
          <strong>
            Cloud workspace
          </strong>
          <span>
            D1-backed ReportOS tools
          </span>
        </span>
      </div>
    </aside>
  );
}
