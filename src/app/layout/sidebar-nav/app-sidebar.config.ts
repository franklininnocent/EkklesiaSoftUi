import { DONATIONS_SIDEBAR_TREE } from '@features/donations/config/stewardship-sidebar.adapter';
import { MINISTRIES_SIDEBAR_TREE } from '@features/ministries-associations/config/ministries-sidebar.adapter';
import { ROLES_PERMISSIONS_SIDEBAR_TREE } from '@features/settings/config/roles-sidebar.adapter';
import { SETTINGS_SIDEBAR_TREE } from '@features/settings/config/settings-sidebar.adapter';
import { CHURCH_PROFILE_SIDEBAR_TREE } from '@features/tenants/church-profile/config/church-profile-sidebar.adapter';
import { SidebarNavNode, SidebarNavSection } from './sidebar-nav.model';

function leaf(
  id: string,
  label: string,
  route: string,
  options: Partial<SidebarNavNode> = {}
): SidebarNavNode {
  return { id, label, route, ...options };
}

/** Authoritative sidebar forest — module subtrees come from feature adapters. */
export function buildAppSidebarSections(): SidebarNavSection[] {
  return [
    {
      id: 'general',
      items: [
        leaf('dashboard', 'Dashboard', '/dashboard', {
          icon: 'dashboard',
          menuId: 'dashboard',
          exact: true,
        }),
        leaf('notifications', 'Notifications', '/notifications', {
          icon: 'notifications',
          menuId: 'notifications',
        }),
      ],
    },
    {
      id: 'parish',
      label: 'Parish',
      items: [
        CHURCH_PROFILE_SIDEBAR_TREE,
        {
          ...leaf('families', 'Families', '/families', {
            icon: 'families',
            menuId: 'families',
          }),
          children: [
            leaf('families-dashboard', 'Dashboard', '/families', { exact: true }),
            leaf('families-list', 'Family List', '/families/list', {
              activePath: '/families/',
            }),
            leaf('members', 'Members', '/members/list', {
              menuId: 'members',
            }),
            leaf('member-birthdays', 'Birthdays', '/members/celebrations', {
              menuId: 'members',
              exact: true,
              query: { tab: 'birthdays' },
              defaultWhenQueryMissing: { tab: 'birthdays' },
            }),
            leaf('member-anniversaries', 'Wedding Anniversaries', '/members/celebrations', {
              menuId: 'members',
              exact: true,
              query: { tab: 'anniversaries' },
            }),
          ],
        },
        leaf('bccs', 'BCCs', '/bccs/list', {
          icon: 'bccs',
          menuId: 'bccs',
          activePath: '/bccs',
        }),
        {
          ...leaf('sacraments', 'Sacraments', '/sacraments', {
            icon: 'sacraments',
            menuId: 'sacraments',
          }),
          children: [
            leaf('sacraments-dashboard', 'Dashboard', '/sacraments', { exact: true }),
            leaf('sacraments-register', 'Register', '/sacraments/register'),
          ],
        },
        {
          ...leaf('mass-intentions', 'Holy Mass', '/mass-intentions', {
            icon: 'mass-intentions',
            menuId: 'mass-intentions',
          }),
          children: [
            leaf('mass-intentions-dashboard', 'Dashboard', '/mass-intentions', { exact: true }),
            leaf('mass-intentions-intentions', 'Intentions', '/mass-intentions/intentions'),
            leaf('mass-intentions-masses', 'Masses', '/mass-intentions/masses'),
          ],
        },
      ],
    },
    {
      id: 'stewardship',
      label: 'Stewardship',
      items: [
        {
          ...DONATIONS_SIDEBAR_TREE,
          icon: 'donations',
          menuId: 'donations',
        },
      ],
    },
    {
      id: 'administration',
      label: 'Administration',
      items: [
        MINISTRIES_SIDEBAR_TREE,
        leaf('users', 'Users', '/users', {
          icon: 'users',
          menuId: 'users',
        }),
        ROLES_PERMISSIONS_SIDEBAR_TREE,
      ],
    },
    {
      id: 'platform',
      label: 'Platform',
      items: [
        leaf('tenants', 'Tenants', '/tenants', {
          icon: 'tenants',
          menuId: 'tenants',
        }),
        leaf('platform-ministries', 'Ministries Insights', '/platform/ministries', {
          icon: 'platform-ministries',
          menuId: 'platform-ministries',
        }),
        leaf('support-center', 'Support Center', '/support-center', {
          icon: 'support-center',
          menuId: 'support-center',
        }),
        leaf('application-access', 'Application Access', '/application-access', {
          icon: 'application-access',
          menuId: 'application-access',
        }),
      ],
    },
    {
      id: 'support',
      items: [
        leaf('support', 'Support', '/support', {
          icon: 'support',
          menuId: 'support',
        }),
      ],
    },
    {
      id: 'settings',
      items: [SETTINGS_SIDEBAR_TREE],
    },
  ];
}

export function filterSidebarSections(
  sections: SidebarNavSection[],
  isVisible: (menuId: string) => boolean,
  isRouteAllowed: (route: string) => boolean = () => true
): SidebarNavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: filterSidebarNodes(section.items, isVisible, isRouteAllowed),
    }))
    .filter((section) => section.items.length > 0);
}

function filterSidebarNodes(
  nodes: SidebarNavNode[],
  isVisible: (menuId: string) => boolean,
  isRouteAllowed: (route: string) => boolean
): SidebarNavNode[] {
  return nodes
    .filter((node) => !node.menuId || isVisible(node.menuId))
    .filter((node) => !node.route || isRouteAllowed(node.route))
    .map((node) => ({
      ...node,
      children: node.children
        ? filterSidebarNodes(node.children, isVisible, isRouteAllowed)
        : undefined,
    }))
    .filter((node) => node.route || (node.children?.length ?? 0) > 0);
}
