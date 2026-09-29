import { test, expect } from '@playwright/test';

const RBAC_TENANT_ADMIN_STORAGE_STATE = process.env.RBAC_TENANT_ADMIN_STORAGE_STATE;

test.describe('Contribution plans schedule', () => {
  test.skip(!RBAC_TENANT_ADMIN_STORAGE_STATE, 'Requires RBAC_TENANT_ADMIN_STORAGE_STATE');

  test.use({ storageState: RBAC_TENANT_ADMIN_STORAGE_STATE! });

  test('plans page loads and shows create form', async ({ page }) => {
    await page.goto('/donations/plans');
    await expect(page.getByRole('heading', { name: /contribution plans/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /new plan/i })).toBeVisible();
  });
});
