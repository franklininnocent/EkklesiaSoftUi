import { MINISTRIES_NAV_LINKS } from './ministries-nav.config';
import { SidebarNavNode } from '../../../layout/sidebar-nav/sidebar-nav.model';

export function buildMinistriesSidebarTree(): SidebarNavNode {
  return {
    id: 'ministries',
    label: 'Ministries & Associations',
    route: '/ministries',
    icon: 'ministries',
    menuId: 'ministries',
    children: MINISTRIES_NAV_LINKS.map((link) => ({
      id: `ministries-${link.id}`,
      label: link.label,
      route: link.path,
      exact: link.exact,
    })),
  };
}

export const MINISTRIES_SIDEBAR_TREE: SidebarNavNode = buildMinistriesSidebarTree();
