import { expect, test } from '@playwright/test';
import {
  createTenantAdminContext,
  createTenantMemberContext,
  skipWithoutTenantAdmin,
  skipWithoutTenantMember
} from './helpers/auth-context';

test.describe('Roles permissions assign flow', () => {
  test('tenant admin can search and filter permissions in assign tab', async ({ browser }) => {
    const skipReason = skipWithoutTenantAdmin();
    test.skip(skipReason !== false, skipReason || 'Tenant admin storage state unavailable');

    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();
    const consoleErrors: string[] = [];

    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });

    await page.goto('/settings/roles-permissions');
    await expect(page.getByText('Roles & Permissions')).toBeVisible();

    await page.getByRole('button', { name: /assign permissions/i }).click();

    const roleCard = page.locator('.role-card').filter({ hasNot: page.locator('.disabled') }).first();
    await expect(roleCard).toBeVisible();
    await roleCard.click();

    await expect(page.getByText(/assigning permissions to/i)).toBeVisible();
    await expect(page.getByRole('searchbox')).toBeVisible();
    await expect(page.getByRole('button', { name: /^filters$/i })).toBeVisible();

    const searchInput = page.getByRole('searchbox');
    await searchInput.fill('view');
    await expect(page.getByText(/\d+ permissions/i)).toBeVisible();

    await page.getByRole('button', { name: /^filters$/i }).click();
    await expect(page.getByRole('button', { name: /apply filters/i })).toBeVisible();

    const moduleSelect = page.locator('select, .ng-select').first();
    if (await moduleSelect.count()) {
      await moduleSelect.click();
    }

    await page.getByRole('button', { name: /apply filters/i }).click();

    const permissionCheckbox = page.locator('.permission-item input[type="checkbox"]').first();
    if (await permissionCheckbox.count()) {
      const wasChecked = await permissionCheckbox.isChecked();
      await permissionCheckbox.click();
      await expect(permissionCheckbox).toBeChecked({ checked: !wasChecked });
    }

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()?.width ?? 1280;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1);
    expect(consoleErrors).toEqual([]);

    await context.close();
  });

  test('tenant admin can clear filters after searching', async ({ browser }) => {
    const skipReason = skipWithoutTenantAdmin();
    test.skip(skipReason !== false, skipReason || 'Tenant admin storage state unavailable');

    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/settings/roles-permissions');
    await page.getByRole('button', { name: /assign permissions/i }).click();
    await page.locator('.role-card').filter({ hasNot: page.locator('.disabled') }).first().click();

    await page.getByRole('searchbox').fill('zzzz-no-match');
    await expect(page.getByText(/no permissions match your search and filters/i)).toBeVisible({ timeout: 10000 });

    const clearSearchButton = page.getByRole('button', { name: /clear search/i });
    if (await clearSearchButton.count()) {
      await clearSearchButton.click();
      await expect(page.getByRole('searchbox')).toHaveValue('');
    }

    await context.close();
  });

  test('tenant member cannot access roles and permissions route', async ({ browser }) => {
    const skipReason = skipWithoutTenantMember();
    test.skip(skipReason !== false, skipReason || 'Tenant member storage state unavailable');

    const context = await createTenantMemberContext(browser);
    const page = await context.newPage();

    await page.goto('/settings/roles-permissions');
    await expect(page).toHaveURL(/\/dashboard|\/auth\/login/);

    await context.close();
  });
});
