export type ChurchProfileTabId = 'profile' | 'leadership' | 'statistics' | 'social' | 'diocesan-bishop';

export type ChurchProfileOverviewActionId =
  | 'edit'
  | 'staff'
  | 'ministries'
  | 'settings'
  | 'report'
  | 'public';

export interface ChurchProfileNavLink {
  id: ChurchProfileTabId | ChurchProfileOverviewActionId;
  label: string;
  path: string;
  query?: Record<string, string>;
  defaultWhenQueryMissing?: Record<string, string>;
  crossLink?: boolean;
  menuId?: 'church-profile-diocesan' | 'church-profile-edit' | 'ministries';
}

export const CHURCH_PROFILE_BASE_ROUTE = '/church-profile';

/** Top-level Church Profile tabs (Overview nests quick actions). */
export const CHURCH_PROFILE_TAB_LINKS: ChurchProfileNavLink[] = [
  {
    id: 'profile',
    label: 'Overview',
    path: CHURCH_PROFILE_BASE_ROUTE,
    query: { tab: 'profile' },
    defaultWhenQueryMissing: { tab: 'profile' },
  },
  {
    id: 'leadership',
    label: 'Leadership',
    path: CHURCH_PROFILE_BASE_ROUTE,
    query: { tab: 'leadership' },
  },
  {
    id: 'statistics',
    label: 'Statistics',
    path: CHURCH_PROFILE_BASE_ROUTE,
    query: { tab: 'statistics' },
  },
  {
    id: 'social',
    label: 'Social Media',
    path: CHURCH_PROFILE_BASE_ROUTE,
    query: { tab: 'social' },
  },
  {
    id: 'diocesan-bishop',
    label: 'Diocesan Bishop',
    path: CHURCH_PROFILE_BASE_ROUTE,
    query: { tab: 'diocesan-bishop' },
    menuId: 'church-profile-diocesan',
  },
];

/** Overview quick actions mirrored from the in-page action bar. */
export const CHURCH_PROFILE_OVERVIEW_ACTION_LINKS: ChurchProfileNavLink[] = [
  {
    id: 'edit',
    label: 'Edit Profile',
    path: CHURCH_PROFILE_BASE_ROUTE,
    query: { tab: 'profile', action: 'edit' },
    menuId: 'church-profile-edit',
  },
  {
    id: 'staff',
    label: 'Manage Staff',
    path: CHURCH_PROFILE_BASE_ROUTE,
    query: { tab: 'leadership' },
    crossLink: true,
  },
  {
    id: 'ministries',
    label: 'Manage Ministries',
    path: '/ministries',
    crossLink: true,
    menuId: 'ministries',
  },
  {
    id: 'settings',
    label: 'Church Settings',
    path: '/settings',
    crossLink: true,
  },
  {
    id: 'report',
    label: 'Generate Report',
    path: CHURCH_PROFILE_BASE_ROUTE,
    query: { tab: 'profile', action: 'report' },
  },
  {
    id: 'public',
    label: 'View Public Profile',
    path: CHURCH_PROFILE_BASE_ROUTE,
    query: { tab: 'profile', action: 'public' },
  },
];

export function parseChurchProfileTabFromUrl(url: string): ChurchProfileTabId | null {
  const query = url.split('?')[1] ?? '';
  const tab = query
    .split('&')
    .map((part) => part.split('='))
    .find(([key]) => key === 'tab')?.[1];

  if (
    tab === 'profile' ||
    tab === 'leadership' ||
    tab === 'statistics' ||
    tab === 'social' ||
    tab === 'diocesan-bishop'
  ) {
    return tab;
  }

  return null;
}
