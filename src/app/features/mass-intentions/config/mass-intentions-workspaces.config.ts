export type MassIntentionsWorkspaceId = 'home' | 'intentions' | 'masses';

export interface MassIntentionsWorkspace {
  id: MassIntentionsWorkspaceId;
  label: string;
  hint: string;
  path: string;
}

export const MASS_INTENTIONS_WORKSPACES: readonly MassIntentionsWorkspace[] = [
  { id: 'home', label: 'Dashboard', hint: 'Parish overview', path: '/mass-intentions' },
  { id: 'intentions', label: 'Intentions', hint: 'Office register', path: '/mass-intentions/intentions' },
  { id: 'masses', label: 'Masses', hint: 'Schedule and tick', path: '/mass-intentions/masses' },
];

export function resolveMassIntentionsWorkspace(url: string): MassIntentionsWorkspaceId {
  const path = url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (path === '/mass-intentions/reports' || path.startsWith('/mass-intentions/settings') || path.startsWith('/mass-intentions/audit')) {
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
