import { expect, test } from '@playwright/test';

import { createTenantAdminContext, skipWithoutTenantAdmin } from './helpers/auth-context';

test.describe('Downloadable reports workbench', () => {
  test('tenant admin can open downloadable reports tab and workbench', async ({ browser }) => {
    test.skip(skipWithoutTenantAdmin(), skipWithoutTenantAdmin() || undefined);

    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/donations/reports?report=payments');
    await expect(page.getByRole('heading', { name: 'Downloadable reports' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('region', { name: 'Active filters' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Refresh preview' })).toBeVisible();

    await context.close();
  });
});
