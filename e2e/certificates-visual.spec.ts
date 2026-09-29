import { expect, test } from '@playwright/test';

const tenantAdminState = process.env.RBAC_TENANT_ADMIN_STORAGE_STATE;
const describeVisual = tenantAdminState ? test.describe : test.describe.skip;

describeVisual('Sacramental certificates visual', () => {
  test('A4 certificate canvas is visible on a sacrament detail page', async ({ browser }) => {
    const context = await browser.newContext({ storageState: tenantAdminState });
    const page = await context.newPage();
    await page.goto('/sacraments');
    const firstRow = page.getByRole('link').first();
    test.skip((await firstRow.count()) === 0, 'No sacrament records available for visual baseline');
    await firstRow.click();
    await expect(page.locator('.cert-page')).toBeVisible({ timeout: 15000 });
    await page.locator('.cert-page').screenshot({
      path: 'e2e/baselines/certificates/a4-live.png',
    });
    await context.close();
  });
});
