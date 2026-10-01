export type MassIntentionsWorkspaceId = 'home' | 'intentions' | 'masses';

/** Optional permission gate for a workspace task link (see shell filter). */
export type MassIntentionsNavAccess = 'register' | 'configure' | 'schedule';

export interface MassIntentionsNavLink {
  path: string;
  label: string;
  exact?: boolean;
  access?: MassIntentionsNavAccess;
}

export interface MassIntentionsWorkspace {
  id: MassIntentionsWorkspaceId;
  label: string;
  hint: string;
  links: MassIntentionsNavLink[];
}

export const MASS_INTENTIONS_WORKSPACES: readonly MassIntentionsWorkspace[] = [
  {
    id: 'home',
    label: 'Dashboard',
    hint: 'Parish overview',
    links: [
      { path: '/mass-intentions', label: 'Overview', exact: true },
      { path: '/mass-intentions/reports', label: 'Reports', access: 'register' },
      { path: '/mass-intentions/settings', label: 'Settings', access: 'configure' },
      { path: '/mass-intentions/audit', label: 'Audit', access: 'configure' },
    ],
  },
  {
    id: 'intentions',
    label: 'Intentions',
    hint: 'Office register',
    links: [{ path: '/mass-intentions/intentions', label: 'Office register', exact: true }],
  },
  {
    id: 'masses',
    label: 'Masses',
    hint: 'Schedule and tick',
    links: [
      { path: '/mass-intentions/masses', label: 'All Masses', exact: true },
      { path: '/mass-intentions/masses/week', label: 'Week view' },
      { path: '/mass-intentions/masses/schedule', label: 'Weekly schedule', access: 'schedule' },
      { path: '/mass-intentions/masses/temporaries', label: 'Temporary schedules', access: 'schedule' },
    ],
  },
];

export function resolveMassIntentionsWorkspace(url: string): MassIntentionsWorkspaceId {
  const path = url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (
    path === '/mass-intentions/reports' ||
    path.startsWith('/mass-intentions/settings') ||
    path.startsWith('/mass-intentions/audit')
  ) {
    return 'home';
  }
  if (path === '/mass-intentions/masses' || path.startsWith('/mass-intentions/masses/')) {
    return 'masses';
  }
  if (path === '/mass-intentions/intentions' || path.startsWith('/mass-intentions/intentions/')) {
    return 'intentions';
  }
  return 'home';
}
