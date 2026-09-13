import { ROLES_NAV_LINKS } from './roles-nav.config';
import { buildRolesPermissionsSidebarTree } from './roles-sidebar.adapter';

describe('roles-sidebar.adapter', () => {
  const tree = buildRolesPermissionsSidebarTree();

  it('maps RBAC tabs as query-driven sidebar children', () => {
    expect(tree.children?.length).toBe(ROLES_NAV_LINKS.length);
    const permissions = tree.children?.find((child) => child.id === 'roles-permissions-permissions');
    expect(permissions?.query).toEqual({ tab: 'permissions' });
  });

  it('defaults roles tab when query is missing', () => {
    const roles = tree.children?.find((child) => child.id === 'roles-permissions-roles');
    expect(roles?.defaultWhenQueryMissing).toEqual({ tab: 'roles' });
  });
});
