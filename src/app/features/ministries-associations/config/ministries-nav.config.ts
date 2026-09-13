export interface MinistriesNavLink {
  id: string;
  label: string;
  path: string;
  exact?: boolean;
}

/** Source of truth for Ministries section navigation (sidebar + in-page sub-nav). */
export const MINISTRIES_NAV_LINKS: MinistriesNavLink[] = [
  { id: 'organizations', label: 'Organizations', path: '/ministries', exact: true },
  { id: 'guests', label: 'Guest members', path: '/ministries/guests' },
  { id: 'settings', label: 'Settings', path: '/ministries/settings' },
  { id: 'audit', label: 'Audit log', path: '/ministries/audit' },
];
