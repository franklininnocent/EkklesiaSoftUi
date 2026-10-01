import { expect, test } from '@playwright/test';

const tenantAdminState = process.env.RBAC_TENANT_ADMIN_STORAGE_STATE;

const viewports = [
  { width: 375, height: 812, name: 'phone' },
  { width: 768, height: 1024, name: 'tablet' },
  { width: 1024, height: 768, name: 'laptop' },
  { width: 1440, height: 900, name: 'desktop' },
];

for (const viewport of viewports) {
  test.describe(`Mass intentions responsive @ ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('home and lists fit without horizontal scroll', async ({ browser }) => {
      test.skip(!tenantAdminState, 'Tenant admin storage state not provided');
      const context = await browser.newContext({ storageState: tenantAdminState });
      const page = await context.newPage();

      for (const path of [
        '/mass-intentions',
        '/mass-intentions/intentions',
        '/mass-intentions/masses',
        '/mass-intentions/masses/schedule',
      ]) {
        await page.goto(path);
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
      }

      await context.close();
    });
  });
}
