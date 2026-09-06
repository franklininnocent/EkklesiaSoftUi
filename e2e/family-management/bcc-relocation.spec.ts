import { expect, test } from '@playwright/test';
import { createTenantAdminContext, skipWithoutTenantAdmin } from '../helpers/auth-context';

test.describe('Family BCC relocation wizard', () => {
  test.skip(skipWithoutTenantAdmin(), 'RBAC tenant admin storage state not provided');

  test('opens relocation wizard and shows preview step', async ({ browser }) => {
    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/families');
    await page.waitForLoadState('networkidle');

    const firstFamilyLink = page.locator('a[href^="/families/"]').first();
    if (await firstFamilyLink.count() === 0) {
      test.skip(true, 'No families available for relocation e2e');
    }

    await firstFamilyLink.click();
    await page.waitForURL(/\/families\/[0-9a-f-]+/i);

    const relocateBtn = page.getByRole('button', { name: /move bcc|relocate/i });
    if (await relocateBtn.count() === 0) {
      test.skip(true, 'Relocate action not visible for current user');
    }

    await relocateBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/target bcc|choose bcc/i)).toBeVisible();

    await context.close();
  });
});
