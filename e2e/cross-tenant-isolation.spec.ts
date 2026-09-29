import { expect, test } from '@playwright/test';

import { createTenantAdminContext, skipWithoutTenantAdmin } from './helpers/auth-context';
import { crossTenantForeignFamilyId, skipWithoutCrossTenantFixture } from './helpers/cross-tenant';

test.describe('Cross-tenant UI isolation', () => {
  test('unknown family id shows safe error without foreign data', async ({ browser }) => {
    test.skip(skipWithoutTenantAdmin(), skipWithoutTenantAdmin() || undefined);

    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/families/00000000-0000-0000-0000-000000000099');
    await expect(page.getByText(/family not found|failed to load family/i)).toBeVisible();
    await expect(page.getByText(/Victim Foreign Family/i)).toHaveCount(0);

    await context.close();
  });

  test('tenant admin cannot open foreign parish family detail', async ({ browser }) => {
    test.skip(skipWithoutCrossTenantFixture(), skipWithoutCrossTenantFixture() || undefined);

    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();
    const foreignFamilyId = crossTenantForeignFamilyId();

    await page.goto(`/families/${foreignFamilyId}`);
    await expect(page.getByText(/family not found|failed to load family/i)).toBeVisible();
    await expect(page.getByText(/Victim Foreign Family/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /edit family/i })).toHaveCount(0);

    await context.close();
  });

  test('family list does not surface foreign family name search', async ({ browser }) => {
    test.skip(skipWithoutCrossTenantFixture(), skipWithoutCrossTenantFixture() || undefined);

    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/families');
    await expect(page).toHaveURL(/\/families/);
    await expect(page.getByText('Victim Foreign Family')).toHaveCount(0);

    const search = page.getByRole('searchbox').first();
    if (await search.isVisible()) {
      await search.fill('Victim Foreign Family');
      await expect(page.getByText('Victim Foreign Family')).toHaveCount(0);
    }

    await context.close();
  });

  test('donations dashboard loads only for signed-in parish', async ({ browser }) => {
    test.skip(skipWithoutTenantAdmin(), skipWithoutTenantAdmin() || undefined);

    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/donations');
    await expect(page).toHaveURL(/\/donations/);
    await expect(page.getByRole('heading', { name: 'Financial Operations Center' })).toBeVisible();
    await expect(page.getByText(/subscription has ended|not enabled/i)).toHaveCount(0);

    await context.close();
  });
});
