import {
  CHURCH_PROFILE_BASE_ROUTE,
  CHURCH_PROFILE_OVERVIEW_ACTION_LINKS,
  CHURCH_PROFILE_TAB_LINKS,
  ChurchProfileNavLink,
} from './church-profile-nav.config';
import { SidebarNavNode } from '../../../../layout/sidebar-nav/sidebar-nav.model';

function mapNavLink(link: ChurchProfileNavLink): SidebarNavNode {
  return {
    id: `church-profile-${link.id}`,
    label: link.label,
    route: link.path,
    exact: link.path === CHURCH_PROFILE_BASE_ROUTE,
    menuId: link.menuId,
    query: link.query,
    defaultWhenQueryMissing: link.defaultWhenQueryMissing,
    crossLink: link.crossLink,
    excludeFromAutoExpand: link.crossLink,
  };
}

export function buildChurchProfileSidebarTree(): SidebarNavNode {
  const overviewActions = CHURCH_PROFILE_OVERVIEW_ACTION_LINKS.map((link) => mapNavLink(link));

  const children = CHURCH_PROFILE_TAB_LINKS.map((link) => {
    const node = mapNavLink(link);

    if (link.id === 'profile') {
      return {
        ...node,
        children: overviewActions,
      };
    }

    return node;
  });

  return {
    id: 'church-profile',
    label: 'Church Profile',
    route: CHURCH_PROFILE_BASE_ROUTE,
    icon: 'church-profile',
    menuId: 'church-profile',
    children,
  };
}

export const CHURCH_PROFILE_SIDEBAR_TREE: SidebarNavNode = buildChurchProfileSidebarTree();
