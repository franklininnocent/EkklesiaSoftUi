import { SETTINGS_NAV_ITEMS } from './settings-nav.config';
import { buildSettingsSidebarTree } from './settings-sidebar.adapter';

describe('settings-sidebar.adapter', () => {
  const tree = buildSettingsSidebarTree();

  it('maps settings hub children from config', () => {
    expect(tree.id).toBe('settings');
    expect(tree.children?.length).toBe(SETTINGS_NAV_ITEMS.length);
  });

  it('nests ecclesiastical routes under ecclesiastical group', () => {
    const ecclesiastical = tree.children?.find((child) => child.id === 'settings-ecclesiastical');
    expect(ecclesiastical?.children?.some((child) => child.route === '/settings/ecclesiastical/bishops')).toBe(
      true
    );
  });
});
