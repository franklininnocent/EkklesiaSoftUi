import { buildAppSidebarSections, filterSidebarSections } from './app-sidebar.config';
import { STEWARDSHIP_WORKSPACES } from '@features/donations/config/stewardship-workspaces.config';
import { CHURCH_PROFILE_TAB_LINKS } from '@features/tenants/church-profile/config/church-profile-nav.config';

describe('app-sidebar.config', () => {
  it('embeds stewardship workspaces as the donations subtree', () => {
    const sections = buildAppSidebarSections();
    const stewardship = sections.find((section) => section.id === 'stewardship');
    const donations = stewardship?.items[0];

    expect(donations?.id).toBe('donations');
    expect(donations?.children?.length).toBe(STEWARDSHIP_WORKSPACES.length);
  });

  it('embeds church profile tabs as the parish subtree', () => {
    const sections = buildAppSidebarSections();
    const parish = sections.find((section) => section.id === 'parish');
    const churchProfile = parish?.items.find((item) => item.id === 'church-profile');

    expect(churchProfile?.children?.length).toBe(CHURCH_PROFILE_TAB_LINKS.length);
    expect(churchProfile?.children?.some((child) => child.id === 'church-profile-social')).toBe(true);
  });

  it('exposes sacraments dashboard and register under the parish menu', () => {
    const sections = buildAppSidebarSections();
    const parish = sections.find((section) => section.id === 'parish');
    const sacraments = parish?.items.find((item) => item.id === 'sacraments');

    expect(sacraments?.route).toBe('/sacraments');
    expect(sacraments?.menuId).toBe('sacraments');
    expect(sacraments?.children?.map((child) => child.id)).toEqual([
      'sacraments-dashboard',
      'sacraments-register',
    ]);
    expect(sacraments?.children?.[0].exact).toBe(true);
    expect(sacraments?.children?.[0].route).toBe('/sacraments');
    expect(sacraments?.children?.[1].route).toBe('/sacraments/register');
    expect(sacraments?.children?.every((child) => child.menuId === undefined)).toBe(true);
  });

  it('exposes Mass intentions dashboard and workspace links', () => {
    const sections = buildAppSidebarSections();
    const parish = sections.find((section) => section.id === 'parish');
    const mass = parish?.items.find((item) => item.id === 'mass-intentions');

    expect(mass?.route).toBe('/mass-intentions');
    expect(mass?.menuId).toBe('mass-intentions');
    expect(mass?.children?.map((child) => child.id)).toEqual([
      'mass-intentions-dashboard',
      'mass-intentions-intentions',
      'mass-intentions-masses',
    ]);
  });

  it('exposes Families dashboard, family list, and member links under the parish menu', () => {
    const sections = buildAppSidebarSections();
    const parish = sections.find((section) => section.id === 'parish');
    const families = parish?.items.find((item) => item.id === 'families');

    expect(parish?.items.some((item) => item.id === 'members')).toBe(false);
    expect(families?.route).toBe('/families');
    expect(families?.menuId).toBe('families');
    expect(families?.children?.map((child) => ({ id: child.id, route: child.route, menuId: child.menuId, exact: child.exact }))).toEqual([
      { id: 'families-dashboard', route: '/families', menuId: undefined, exact: true },
      { id: 'families-list', route: '/families/list', menuId: undefined, exact: undefined },
      { id: 'members', route: '/members/list', menuId: 'members', exact: undefined },
      { id: 'member-birthdays', route: '/members/celebrations', menuId: 'members', exact: true },
      { id: 'member-anniversaries', route: '/members/celebrations', menuId: 'members', exact: true },
    ]);
  });

  it('hides the Members submenu without removing Families or Dashboard', () => {
    const sections = filterSidebarSections(buildAppSidebarSections(), (menuId) => menuId !== 'members');
    const parish = sections.find((section) => section.id === 'parish');
    const families = parish?.items.find((item) => item.id === 'families');

    expect(families?.route).toBe('/families');
    expect(families?.children?.map((child) => child.id)).toEqual(['families-dashboard', 'families-list']);
  });

  it('filters items by menu visibility', () => {
    const sections = filterSidebarSections(buildAppSidebarSections(), (menuId) => menuId !== 'tenants');
    const platform = sections.find((section) => section.id === 'platform');

    expect(platform?.items.some((item) => item.id === 'tenants')).toBe(false);
    expect(platform?.items.some((item) => item.id === 'support-center')).toBe(true);
  });
});
