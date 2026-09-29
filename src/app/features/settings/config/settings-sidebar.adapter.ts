import { NavMenuId } from '@core/services/nav-menu.service';
import { SidebarNavNode } from '../../../layout/sidebar-nav/sidebar-nav.model';
import { SETTINGS_NAV_ITEMS, SettingsNavItem } from './settings-nav.config';

function menuIdForItem(item: SettingsNavItem): NavMenuId {
  if (item.visibility) {
    return `settings-${item.visibility}` as NavMenuId;
  }
  if (item.id.startsWith('settings-ecclesiastical-')) {
    return 'settings-ecclesiastical';
  }
  return 'settings';
}

function mapSettingsItem(item: SettingsNavItem): SidebarNavNode {
  return {
    id: item.id,
    label: item.label,
    route: item.route,
    exact: item.exact,
    menuId: menuIdForItem(item),
    children: item.children?.map(mapSettingsItem),
  };
}

export function buildSettingsSidebarTree(): SidebarNavNode {
  return {
    id: 'settings',
    label: 'Settings',
    route: '/settings',
    icon: 'settings',
    menuId: 'settings',
    exact: true,
    children: SETTINGS_NAV_ITEMS.map(mapSettingsItem),
  };
}

export const SETTINGS_SIDEBAR_TREE: SidebarNavNode = buildSettingsSidebarTree();
