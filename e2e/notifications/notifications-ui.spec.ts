import { expect, test } from '@playwright/test';
import {
  createTenantAdminContext,
  skipWithoutTenantAdmin,
} from '../helpers/auth-context';

test.describe('Notifications UI', () => {
  test('shows bell and notification center', async ({ browser }) => {
    test.skip(skipWithoutTenantAdmin(), skipWithoutTenantAdmin() || undefined);

    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/dashboard');
    const bell = page.locator('.notification-bell');
    await expect(bell).toBeVisible();
    await bell.click();
    await expect(page.getByRole('dialog', { name: /notifications/i })).toBeVisible();

    await page.goto('/notifications');
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Unread' })).toBeVisible();

    await context.close();
  });

  test('preferences page loads', async ({ browser }) => {
    test.skip(skipWithoutTenantAdmin(), skipWithoutTenantAdmin() || undefined);

    const context = await createTenantAdminContext(browser);
    const page = await context.newPage();

    await page.goto('/settings/notifications');
    await expect(page.getByRole('heading', { name: /notification preferences/i })).toBeVisible();

    await context.close();
  });
});
