import { isParishProductApiPath, PARISH_PRODUCT_API_PREFIXES } from './parish-product-api-paths';

describe('parish-product-api-paths', () => {
  it('includes church management prefixes used by Support diagnosis', () => {
    expect(PARISH_PRODUCT_API_PREFIXES).toEqual(
      expect.arrayContaining([
        '/api/church-profile',
        '/api/church-leadership',
        '/api/church-statistics',
        '/api/church-social-media',
      ])
    );
  });

  it('matches parish paths and excludes platform paths', () => {
    expect(isParishProductApiPath('/api/church-leadership')).toBe(true);
    expect(isParishProductApiPath('/api/church-statistics')).toBe(true);
    expect(isParishProductApiPath('/api/tenant/ministries/module-status')).toBe(true);
    expect(isParishProductApiPath('/api/users')).toBe(false);
    expect(isParishProductApiPath('/api/support/tickets')).toBe(false);
    expect(isParishProductApiPath('/api/admin/ministries/overview')).toBe(false);
  });
});
