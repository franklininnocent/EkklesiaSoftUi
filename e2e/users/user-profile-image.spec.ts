import { expect, test } from '@playwright/test';
import { createTenantAdminContext, skipWithoutTenantAdmin } from '../helpers/auth-context';

test.describe('User profile image', () => {
  test.skip(skipWithoutTenantAdmin(), 'RBAC tenant admin storage state not available');

  test('shows avatar fallback and opens viewer when photo exists', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/users');
    await page.waitForLoadState('networkidle');

    const photoTrigger = page.getByRole('button', { name: /^View photo of / });
    if ((await photoTrigger.count()) === 0) {
      await context.close();
      test.skip(true, 'No user profile photos available in this tenant');
      return;
    }

    await photoTrigger.first().click();
    await expect(page.getByRole('region', { name: 'Image preview' })).toBeVisible();
    await page.getByRole('button', { name: 'Close image viewer' }).click();
    await expect(page.getByRole('region', { name: 'Image preview' })).toHaveCount(0);

    await context.close();
  });

  test('users list still renders without profile photos', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/users');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
    const rows = page.locator('tbody tr');
    if ((await rows.count()) > 0) {
      await expect(rows.first()).toBeVisible();
    }

    await context.close();
  });
});
