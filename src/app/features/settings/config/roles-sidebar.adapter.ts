import { ROLES_NAV_LINKS, ROLES_PERMISSIONS_BASE_ROUTE } from './roles-nav.config';
import { SidebarNavNode } from '../../../layout/sidebar-nav/sidebar-nav.model';

export function buildRolesPermissionsSidebarTree(): SidebarNavNode {
  return {
    id: 'roles-permissions',
    label: 'Roles & Permissions',
    route: ROLES_PERMISSIONS_BASE_ROUTE,
    icon: 'roles-permissions',
    menuId: 'roles-permissions',
    children: ROLES_NAV_LINKS.map((link) => ({
      id: `roles-permissions-${link.id}`,
      label: link.label,
      route: ROLES_PERMISSIONS_BASE_ROUTE,
      exact: true,
      menuId: link.menuId,
      query: { tab: link.id },
      defaultWhenQueryMissing: link.id === 'roles' ? { tab: 'roles' } : undefined,
    })),
  };
}

export const ROLES_PERMISSIONS_SIDEBAR_TREE: SidebarNavNode = buildRolesPermissionsSidebarTree();
