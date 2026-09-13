import {
  CHURCH_PROFILE_OVERVIEW_ACTION_LINKS,
  CHURCH_PROFILE_TAB_LINKS,
} from './church-profile-nav.config';
import { buildChurchProfileSidebarTree } from './church-profile-sidebar.adapter';

describe('church-profile-sidebar.adapter', () => {
  const tree = buildChurchProfileSidebarTree();

  it('maps church profile root with tab children from config', () => {
    expect(tree.id).toBe('church-profile');
    expect(tree.children?.length).toBe(CHURCH_PROFILE_TAB_LINKS.length);
    expect(tree.children?.map((child) => child.label)).toEqual(
      CHURCH_PROFILE_TAB_LINKS.map((link) => link.label)
    );
  });

  it('nests overview quick actions under overview', () => {
    const overview = tree.children?.find((child) => child.id === 'church-profile-profile');
    expect(overview?.query).toEqual({ tab: 'profile' });
    expect(overview?.defaultWhenQueryMissing).toEqual({ tab: 'profile' });
    expect(overview?.children?.length).toBe(CHURCH_PROFILE_OVERVIEW_ACTION_LINKS.length);
    expect(overview?.children?.map((child) => child.label)).toEqual(
      CHURCH_PROFILE_OVERVIEW_ACTION_LINKS.map((link) => link.label)
    );
  });

  it('maps edit profile with action query and edit menu id', () => {
    const overview = tree.children?.find((child) => child.id === 'church-profile-profile');
    const edit = overview?.children?.find((child) => child.id === 'church-profile-edit');
    expect(edit?.query).toEqual({ tab: 'profile', action: 'edit' });
    expect(edit?.menuId).toBe('church-profile-edit');
  });

  it('marks manage ministries as cross-link under overview', () => {
    const overview = tree.children?.find((child) => child.id === 'church-profile-profile');
    const ministries = overview?.children?.find((child) => child.id === 'church-profile-ministries');
    expect(ministries?.route).toBe('/ministries');
    expect(ministries?.crossLink).toBe(true);
    expect(ministries?.menuId).toBe('ministries');
  });

  it('does not keep ministries at church profile root', () => {
    expect(tree.children?.some((child) => child.id === 'church-profile-ministries')).toBe(false);
  });

  it('gates diocesan bishop child with dedicated menu id', () => {
    const diocesan = tree.children?.find((child) => child.id === 'church-profile-diocesan-bishop');
    expect(diocesan?.menuId).toBe('church-profile-diocesan');
    expect(diocesan?.query).toEqual({ tab: 'diocesan-bishop' });
  });
});
