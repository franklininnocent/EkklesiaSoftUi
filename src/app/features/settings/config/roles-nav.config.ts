export type RolesPermissionsTabId = 'roles' | 'permissions' | 'assign' | 'users';

export interface RolesNavLink {
  id: RolesPermissionsTabId;
  label: string;
  menuId: 'roles-permissions' | 'roles-permissions-assignments';
}

const RBAC_BASE = '/settings/roles-permissions';

/** Sidebar + URL tab source of truth (Pope tab remains in-page only). */
export const ROLES_NAV_LINKS: RolesNavLink[] = [
  { id: 'roles', label: 'Roles', menuId: 'roles-permissions' },
  { id: 'permissions', label: 'Permissions', menuId: 'roles-permissions' },
  { id: 'assign', label: 'Assign Permissions', menuId: 'roles-permissions' },
  { id: 'users', label: 'User Role Assignments', menuId: 'roles-permissions-assignments' },
];

export const ROLES_PERMISSIONS_BASE_ROUTE = RBAC_BASE;

export function rolesTabRoute(tab: RolesPermissionsTabId): string {
  return `${RBAC_BASE}?tab=${tab}`;
}

export function parseRolesTabFromUrl(url: string): RolesPermissionsTabId | null {
  const query = url.split('?')[1] ?? '';
  const tab = query
    .split('&')
    .map((part) => part.split('='))
    .find(([key]) => key === 'tab')?.[1];

  if (tab === 'roles' || tab === 'permissions' || tab === 'assign' || tab === 'users') {
    return tab;
  }

  return null;
}
