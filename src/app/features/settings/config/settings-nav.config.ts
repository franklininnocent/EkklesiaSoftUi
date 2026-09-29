import { SettingsNavVisibilityKey } from './settings-nav.visibility';

export interface SettingsNavItem {
  id: string;
  label: string;
  route: string;
  exact?: boolean;
  visibility?: SettingsNavVisibilityKey;
  requiresPermission?: boolean;
  children?: SettingsNavItem[];
}

const ECCLESIASTICAL_BASE = '/settings/ecclesiastical';

/** Routed Settings destinations for sidebar (hub cards without routes are omitted). */
export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  {
    id: 'settings-my-subscription',
    label: 'My Subscription',
    route: '/settings/my-subscription',
    visibility: 'my-subscription',
  },
  {
    id: 'settings-ecclesiastical',
    label: 'Ecclesiastical Data',
    route: ECCLESIASTICAL_BASE,
    visibility: 'ecclesiastical',
    children: [
      { id: 'settings-ecclesiastical-overview', label: 'Overview', route: `${ECCLESIASTICAL_BASE}/overview` },
      { id: 'settings-ecclesiastical-dioceses', label: 'Dioceses', route: `${ECCLESIASTICAL_BASE}/dioceses` },
      { id: 'settings-ecclesiastical-bishops', label: 'Bishops', route: `${ECCLESIASTICAL_BASE}/bishops` },
      {
        id: 'settings-ecclesiastical-bishop-updates',
        label: 'Suggestions',
        route: `${ECCLESIASTICAL_BASE}/bishop-updates`,
      },
      {
        id: 'settings-ecclesiastical-sacrament-types',
        label: 'Sacrament Types',
        route: `${ECCLESIASTICAL_BASE}/sacrament-types`,
      },
    ],
  },
  {
    id: 'settings-pope',
    label: 'Pope Details',
    route: '/settings/pope',
    visibility: 'pope',
  },
  {
    id: 'settings-sacrament-settings',
    label: 'Sacrament Settings',
    route: '/settings/sacraments',
    visibility: 'sacrament-settings',
  },
  {
    id: 'settings-subscription',
    label: 'Subscription',
    route: '/settings/subscription',
    visibility: 'subscription',
  },
  {
    id: 'settings-support-access',
    label: 'Support access windows',
    route: '/settings/support-access',
    visibility: 'support-access',
  },
  {
    id: 'settings-forgot-password-requests',
    label: 'Forgot Password Requests',
    route: '/settings/forgot-password-requests',
    visibility: 'forgot-password-requests',
  },
  {
    id: 'settings-data-export',
    label: 'Data Export',
    route: '/settings/data-export',
    visibility: 'data-export',
    requiresPermission: true,
  },
  {
    id: 'settings-default-seeds',
    label: 'Recommended defaults',
    route: '/settings/default-seeds',
    visibility: 'default-seeds',
    requiresPermission: true,
  },
];
