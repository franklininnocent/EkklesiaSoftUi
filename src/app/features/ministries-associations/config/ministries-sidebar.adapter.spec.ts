import { MINISTRIES_NAV_LINKS } from './ministries-nav.config';
import { buildMinistriesSidebarTree } from './ministries-sidebar.adapter';

describe('ministries-sidebar.adapter', () => {
  const tree = buildMinistriesSidebarTree();

  it('maps ministries root with children from config', () => {
    expect(tree.id).toBe('ministries');
    expect(tree.children?.length).toBe(MINISTRIES_NAV_LINKS.length);
    expect(tree.children?.map((child) => child.label)).toEqual(
      MINISTRIES_NAV_LINKS.map((link) => link.label)
    );
  });

  it('marks organizations as exact match', () => {
    const organizations = tree.children?.find((child) => child.id === 'ministries-organizations');
    expect(organizations?.route).toBe('/ministries');
    expect(organizations?.exact).toBe(true);
  });
});
