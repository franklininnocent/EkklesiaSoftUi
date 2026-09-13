import { STEWARDSHIP_WORKSPACES } from './stewardship-workspaces.config';
import { SidebarNavNode } from '../../../layout/sidebar-nav/sidebar-nav.model';

/** Map stewardship workspaces to a sidebar tree (single consumer alongside the in-module shell). */
export function buildDonationsSidebarTree(): SidebarNavNode {
  return {
    id: 'donations',
    label: 'Stewardship & Donations',
    route: '/donations',
    children: STEWARDSHIP_WORKSPACES.map((workspace) => ({
      id: `donations-${workspace.id}`,
      label: workspace.label,
      children: workspace.links.map((link) => ({
        id: `donations-${workspace.id}-${slugFromPath(link.path)}`,
        label: link.label,
        route: link.path,
        exact: link.exact,
        crossLink: !link.path.startsWith('/donations'),
        excludeFromAutoExpand: !link.path.startsWith('/donations'),
      })),
    })),
  };
}

function slugFromPath(path: string): string {
  const segment = path.replace(/^\//, '').split('/').filter(Boolean).pop() ?? 'root';
  return segment.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
}

export const DONATIONS_SIDEBAR_TREE: SidebarNavNode = buildDonationsSidebarTree();
