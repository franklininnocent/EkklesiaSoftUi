import { expect, test } from '@playwright/test';
import { createTenantAdminContext, skipWithoutTenantAdmin } from '../helpers/auth-context';

test.describe('Marriage household wizard', () => {
  test.skip(skipWithoutTenantAdmin(), 'RBAC tenant admin storage state not provided');

  test('opens marriage household modal', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/families');
    await page.waitForLoadState('networkidle');

    const firstFamilyLink = page.locator('a[href^="/families/"]').first();
    if (await firstFamilyLink.count() === 0) {
      test.skip(true, 'No families available for marriage e2e');
    }

    await firstFamilyLink.click();
    await page.waitForURL(/\/families\/[0-9a-f-]+/i);

    const marriageBtn = page.getByRole('button', { name: /marriage household/i });
    if (await marriageBtn.count() === 0) {
      test.skip(true, 'Marriage action not visible for current user');
    }

    await marriageBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/new household|join existing/i)).toBeVisible();

    await context.close();
  });
});
