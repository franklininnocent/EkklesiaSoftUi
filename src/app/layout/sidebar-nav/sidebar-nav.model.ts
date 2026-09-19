import { NavMenuId } from '@core/services/nav-menu.service';

export type SidebarNavIconId =
  | 'dashboard'
  | 'church-profile'
  | 'families'
  | 'bccs'
  | 'members'
  | 'donations'
  | 'ministries'
  | 'tenants'
  | 'platform-ministries'
  | 'roles-permissions'
  | 'sacraments'
  | 'users'
  | 'support'
  | 'support-center'
  | 'application-access'
  | 'notifications'
  | 'settings';

export interface SidebarNavNode {
  id: string;
  label: string;
  route?: string;
  exact?: boolean;
  icon?: SidebarNavIconId;
  menuId?: NavMenuId;
  query?: Record<string, string>;
  /** When URL omits a query key, treat these values as matched (e.g. default RBAC tab). */
  defaultWhenQueryMissing?: Record<string, string>;
  /** Secondary link to a route owned elsewhere (e.g. Family Directory under Donations). */
  crossLink?: boolean;
  /** @deprecated Use crossLink. Kept for stewardship adapter compatibility. */
  excludeFromAutoExpand?: boolean;
  children?: SidebarNavNode[];
}

export interface SidebarNavSection {
  id: string;
  label?: string;
  items: SidebarNavNode[];
}

export interface NavActivation {
  activeId: string | null;
  ancestorIds: Set<string>;
}
