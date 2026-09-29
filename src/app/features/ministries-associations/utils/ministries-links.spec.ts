import { ministriesBasePath, ministriesLink } from './ministries-links';

describe('ministriesLink helpers', () => {
  it('uses absolute /ministries when not under tenant route', () => {
    expect(ministriesBasePath('/ministries')).toBe('/ministries');
    expect(ministriesLink('/ministries/settings', 'guests')).toBe('/ministries/guests');
  });

  it('preserves tenant prefix for nested ministries routes', () => {
    const url = '/tenant/42/ministries/orgs/abc?tab=members';
    expect(ministriesBasePath(url)).toBe('/tenant/42/ministries');
    expect(ministriesLink(url)).toBe('/tenant/42/ministries');
    expect(ministriesLink(url, 'settings')).toBe('/tenant/42/ministries/settings');
    expect(ministriesLink(url, 'new')).toBe('/tenant/42/ministries/new');
  });
});
