import { STEWARDSHIP_WORKSPACES } from './stewardship-workspaces.config';
import { buildDonationsSidebarTree } from './stewardship-sidebar.adapter';

describe('stewardship-sidebar.adapter', () => {
  const tree = buildDonationsSidebarTree();

  it('maps root with donations id and label', () => {
    expect(tree.id).toBe('donations');
    expect(tree.label).toBe('Stewardship & Donations');
    expect(tree.route).toBe('/donations');
  });

  it('maps all four workspaces', () => {
    expect(tree.children?.length).toBe(4);
    expect(tree.children?.map((c) => c.label)).toEqual(
      STEWARDSHIP_WORKSPACES.map((w) => w.label)
    );
  });

  it('maps all workspace links with paths from config', () => {
    const linkCount = STEWARDSHIP_WORKSPACES.reduce((sum, w) => sum + w.links.length, 0);
    const sidebarLinks = tree.children?.flatMap((w) => w.children ?? []) ?? [];
    expect(sidebarLinks.length).toBe(linkCount);
  });

  it('preserves dashboard exact flag and collect dues/donors links', () => {
    const leadership = tree.children?.find((c) => c.id === 'donations-leadership');
    const dashboard = leadership?.children?.find((c) => c.route === '/donations');
    expect(dashboard?.exact).toBe(true);
    expect(dashboard?.label).toBe('Overview');
    const leadershipLabels = leadership?.children?.map((child) => child.label) ?? [];
    const notificationsIndex = leadershipLabels.indexOf('Notifications');
    expect(leadershipLabels[notificationsIndex + 1]).toBe('Download History');

    const collect = tree.children?.find((c) => c.id === 'donations-collect');
    const routes = collect?.children?.map((c) => c.route) ?? [];
    expect(routes).toContain('/donations/dues');
    expect(routes).toContain('/donations/donors');
    expect(routes).toContain('/donations/today-collections');
  });

  it('includes configure children routes', () => {
    const configure = tree.children?.find((c) => c.id === 'donations-configure');
    const routes = configure?.children?.map((c) => c.route) ?? [];
    expect(routes).toContain('/donations/plans');
    expect(routes).toContain('/donations/categories');
    expect(routes).toContain('/donations/settings');
  });
});
