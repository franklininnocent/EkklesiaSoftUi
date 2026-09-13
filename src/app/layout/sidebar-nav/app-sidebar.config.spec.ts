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

  it('filters items by menu visibility', () => {
    const sections = filterSidebarSections(buildAppSidebarSections(), (menuId) => menuId !== 'tenants');
    const platform = sections.find((section) => section.id === 'platform');

    expect(platform?.items.some((item) => item.id === 'tenants')).toBe(false);
    expect(platform?.items.some((item) => item.id === 'support-center')).toBe(true);
  });
});
